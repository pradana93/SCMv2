import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Store, Download, Upload, Pencil, Search } from "lucide-react";
import * as XLSX from "xlsx";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import ConfirmDeleteDialog from "./ConfirmDeleteDialog";

const normKey = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

export default function MasterOutletList({ canDelete, canEdit, canAdd = true }) {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({ queryKey: ["outlets"], queryFn: () => base44.entities.Outlet.list() });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState("");
  const [pemilik, setPemilik] = useState("");
  const [eta, setEta] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [importMsg, setImportMsg] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(new Set());
  const [confirmId, setConfirmId] = useState(null);
  const [confirmBulk, setConfirmBulk] = useState(false);
  const fileRef = useRef(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ["outlets"] });

  const openAdd = () => { setEditing(null); setName(""); setPemilik(""); setEta(""); setError(""); setOpen(true); };
  const openEdit = (o) => { setEditing(o); setName(o.name); setPemilik(o.pemilik || ""); setEta(o.eta || ""); setError(""); setOpen(true); };

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) { setError("Nama outlet wajib diisi."); return; }
    const dup = data.some((o) => o.name.toLowerCase() === trimmed.toLowerCase() && o.id !== editing?.id);
    if (dup) { setError("Outlet sudah ada."); return; }
    setBusy(true); setError("");
    try {
      if (editing) await base44.entities.Outlet.update(editing.id, { name: trimmed, pemilik: pemilik.trim(), eta: eta.trim() });
      else await base44.entities.Outlet.create({ name: trimmed, pemilik: pemilik.trim(), eta: eta.trim() });
      setName(""); setPemilik(""); setEta(""); setEditing(null); setOpen(false); refresh();
    } catch { setError("Gagal menyimpan outlet."); }
    finally { setBusy(false); }
  };
  const remove = async (id) => { setBusy(true); try { await base44.entities.Outlet.delete(id); setSelected((p) => { const n = new Set(p); n.delete(id); return n; }); refresh(); } finally { setBusy(false); } };
  const removeMany = async () => {
    const ids = [...selected];
    setConfirmBulk(false);
    if (!ids.length) return;
    setBusy(true);
    try { await base44.entities.Outlet.deleteMany({ id: { $in: ids } }); setSelected(new Set()); refresh(); }
    finally { setBusy(false); }
  };
  const toggle = (id) => setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allSelected = data.length > 0 && selected.size === data.length;
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(data.map((o) => o.id)));

  const downloadTemplate = () => {
    const rows = [["Nama Outlet", "Pemilik", "ETA"], ["Bangor - Contoh 1", "Mitra", "1 Hari"], ["Bangor - Contoh 2", "Mitra", "14 Hari"]];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [{ wch: 26 }, { wch: 16 }, { wch: 12 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Outlet");
    XLSX.writeFile(wb, "template-outlet.xlsx");
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true); setImportMsg("");
    try {
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
      const nameKeys = ["namaoutlet", "namaoutletbaru", "outlet", "outletname", "tujuan", "tujuanpengiriman"];
      const pemilikKeys = ["pemilik", "owner", "pemilikoutlet"];
      const etaKeys = ["eta", "estimasi", "leadtime"];
      const outlets = rows.map((r) => {
        const entries = Object.entries(r);
        const nameEntry = entries.find(([k]) => nameKeys.includes(normKey(k)));
        const pemilikEntry = entries.find(([k]) => pemilikKeys.includes(normKey(k)));
        const etaEntry = entries.find(([k]) => etaKeys.includes(normKey(k)));
        return {
          name: String(nameEntry ? nameEntry[1] : "").trim(),
          pemilik: String(pemilikEntry ? pemilikEntry[1] : "").trim(),
          eta: String(etaEntry ? etaEntry[1] : "").trim(),
        };
      }).filter((o) => o.name);
      const unique = [];
      const seen = new Set();
      for (const o of outlets) { const k = o.name.toLowerCase(); if (!seen.has(k)) { seen.add(k); unique.push(o); } }
      if (!unique.length) throw new Error("Tidak ada baris valid. Pastikan kolom Nama Outlet terisi.");
      await base44.entities.Outlet.bulkCreate(unique);
      setImportMsg(`${unique.length} outlet berhasil diimpor.`);
      refresh();
    } catch (err) {
      setImportMsg(err?.message ? `Impor gagal: ${err.message}` : "Impor gagal. Periksa format file.");
    } finally { setBusy(false); e.target.value = ""; }
  };

  return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2"><Store className="h-5 w-5 text-indigo-600" /><h2 className="text-lg font-bold">Daftar Outlet Tujuan</h2></div>
      {canAdd && <button onClick={openAdd} className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"><Plus className="h-4 w-4" />Tambah</button>}
    </div>
    <div className="mt-4 flex flex-col gap-2 sm:flex-row">
      <button onClick={downloadTemplate} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3.5 py-2 text-sm font-semibold transition hover:bg-slate-50"><Download className="h-4 w-4" />Download Template</button>
      {canAdd && <button onClick={() => fileRef.current?.click()} disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3.5 py-2 text-sm font-semibold transition hover:bg-slate-50 disabled:opacity-60"><Upload className="h-4 w-4" />{busy ? "Mengimpor..." : "Import Data"}</button>}
      <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleImport} className="hidden" />
    </div>
    {importMsg && <p className="mt-2 text-sm text-slate-600">{importMsg}</p>}
    {canDelete && data.length > 0 && <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
      <label className="flex items-center gap-2 text-sm font-medium text-slate-600"><Checkbox checked={allSelected} onCheckedChange={toggleAll} />Pilih Semua</label>
      {selected.size > 0 && <button onClick={() => setConfirmBulk(true)} disabled={busy} className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" />Hapus Terpilih ({selected.size})</button>}
    </div>}
    <div className="mt-4 relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari outlet..." className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" />
    </div>
    <div className="mt-4 max-h-72 space-y-2 overflow-y-auto">
      {(() => {
        const q = search.trim().toLowerCase();
        const list = (data || []).filter((o) => !q || String(o.name || "").toLowerCase().includes(q) || String(o.pemilik || "").toLowerCase().includes(q)).sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "id", { sensitivity: "base" }));
        if (isLoading) return <p className="text-sm text-slate-400">Memuat...</p>;
        if (!data.length) return <p className="text-sm text-slate-400">Belum ada outlet.</p>;
        if (!list.length) return <p className="text-sm text-slate-400">Tidak ada outlet yang cocok.</p>;
        return list.map((o) => (
          <div key={o.id} className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-2.5">
            <div className="flex min-w-0 items-center gap-2">
              {canDelete && <Checkbox checked={selected.has(o.id)} onCheckedChange={() => toggle(o.id)} />}
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{o.name}</p>
                <p className="truncate text-xs text-slate-400">Pemilik: {o.pemilik || "-"}{o.eta ? ` · ETA: ${o.eta}` : ""}</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {canEdit && <button onClick={() => openEdit(o)} disabled={busy} className="rounded-lg p-1.5 text-slate-600 transition hover:bg-slate-100"><Pencil className="h-4 w-4" /></button>}
              {canDelete && <button onClick={() => setConfirmId(o.id)} disabled={busy} className="rounded-lg p-1.5 text-red-600 transition hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>}
            </div>
          </div>
        ));
      })()}
    </div>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader><DialogTitle>{editing ? "Edit Outlet" : "Tambah Outlet"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <label className="block text-sm font-medium">Nama Outlet<input value={name} onChange={(e) => setName(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" /></label>
          <label className="block text-sm font-medium">Pemilik<input value={pemilik} onChange={(e) => setPemilik(e.target.value)} placeholder="Mitra / Korporat / ..." className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" /></label>
          <label className="block text-sm font-medium">ETA<input value={eta} onChange={(e) => setEta(e.target.value)} placeholder="contoh: 1 Hari" className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" /></label>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Batal</Button>
          <Button onClick={submit} disabled={busy}>{busy ? "Menyimpan..." : "Simpan"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <ConfirmDeleteDialog open={!!confirmId} onClose={() => setConfirmId(null)} onConfirm={() => { const id = confirmId; setConfirmId(null); if (id) remove(id); }} />
    <ConfirmDeleteDialog open={confirmBulk} onClose={() => setConfirmBulk(false)} onConfirm={removeMany} count={selected.size} />
  </div>;
}
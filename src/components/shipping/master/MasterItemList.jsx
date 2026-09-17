import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Package, Pencil, Search } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import ConfirmDeleteDialog from "./ConfirmDeleteDialog";

const normKey = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

export default function MasterItemList({ canDelete, canEdit }) {
  const qc = useQueryClient();
  const { data: items = [], isLoading } = useQuery({ queryKey: ["items"], queryFn: () => base44.entities.Item.list() });
  const { data: shipments = [] } = useQuery({ queryKey: ["shipments-all-items"], queryFn: () => base44.entities.Shipment.list("-created_date", 5000) });
  const { data: master = [] } = useQuery({ queryKey: ["masterPackingItems"], queryFn: () => base44.entities.MasterPackingItem.list() });

  const masterMap = new Map();
  for (const m of master) if (m && m.name) masterMap.set(normKey(m.name), m);
  const refresh = () => qc.invalidateQueries({ queryKey: ["items"] });

  useEffect(() => {
    if (isLoading) return;
    const existing = new Set(items.map((o) => normKey(o.name)));
    const missing = [];
    const seen = new Set();
    for (const s of shipments) {
      const arr = Array.isArray(s.do_items) ? s.do_items : [];
      for (const it of arr) {
        const nm = String(it?.name || "").trim();
        if (!nm) continue;
        const k = normKey(nm);
        if (existing.has(k) || seen.has(k)) continue;
        seen.add(k);
        const m = masterMap.get(k);
        const satuan = m?.satuan || String(it?.unit || "").trim() || "";
        missing.push({ name: nm, satuan });
      }
    }
    if (!missing.length) return;
    let cancelled = false;
    base44.entities.Item.bulkCreate(missing).then(() => { if (!cancelled) refresh(); }).catch(() => {});
    return () => { cancelled = true; };
  }, [items, shipments, isLoading]);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState("");
  const [satuan, setSatuan] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(new Set());
  const [confirmId, setConfirmId] = useState(null);
  const [confirmBulk, setConfirmBulk] = useState(false);

  const openAdd = () => { setEditing(null); setName(""); setSatuan(""); setError(""); setOpen(true); };
  const openEdit = (o) => { setEditing(o); setName(o.name); setSatuan(o.satuan || ""); setError(""); setOpen(true); };

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) { setError("Nama barang wajib diisi."); return; }
    const dup = items.some((o) => o.name.toLowerCase() === trimmed.toLowerCase() && o.id !== editing?.id);
    if (dup) { setError("Barang sudah ada."); return; }
    setBusy(true); setError("");
    try {
      if (editing) await base44.entities.Item.update(editing.id, { name: trimmed, satuan: satuan.trim() });
      else await base44.entities.Item.create({ name: trimmed, satuan: satuan.trim() });
      setName(""); setSatuan(""); setEditing(null); setOpen(false); refresh();
    } catch { setError("Gagal menyimpan barang."); }
    finally { setBusy(false); }
  };
  const remove = async (id) => { setBusy(true); try { await base44.entities.Item.delete(id); setSelected((p) => { const n = new Set(p); n.delete(id); return n; }); refresh(); } finally { setBusy(false); } };
  const removeMany = async () => {
    const ids = [...selected];
    setConfirmBulk(false);
    if (!ids.length) return;
    setBusy(true);
    try { await base44.entities.Item.deleteMany({ id: { $in: ids } }); setSelected(new Set()); refresh(); }
    finally { setBusy(false); }
  };
  const toggle = (id) => setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allSelected = items.length > 0 && selected.size === items.length;
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(items.map((o) => o.id)));

  return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2"><Package className="h-5 w-5 text-indigo-600" /><h2 className="text-lg font-bold">Daftar Nama Barang</h2></div>
      {canEdit && <button onClick={openAdd} className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"><Plus className="h-4 w-4" />Tambah</button>}
    </div>
    <p className="mt-1 text-xs text-slate-400">Terisi otomatis dari seluruh item pada Delivery Order.</p>
    {canDelete && items.length > 0 && <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
      <label className="flex items-center gap-2 text-sm font-medium text-slate-600"><Checkbox checked={allSelected} onCheckedChange={toggleAll} />Pilih Semua</label>
      {selected.size > 0 && <button onClick={() => setConfirmBulk(true)} disabled={busy} className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" />Hapus Terpilih ({selected.size})</button>}
    </div>}
    <div className="mt-4 relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nama barang..." className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" />
    </div>
    <div className="mt-4 max-h-72 space-y-2 overflow-y-auto">
      {(() => {
        const q = search.trim().toLowerCase();
        const list = (items || []).filter((o) => !q || String(o.name || "").toLowerCase().includes(q) || String(o.satuan || "").toLowerCase().includes(q)).sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "id", { sensitivity: "base" }));
        if (isLoading) return <p className="text-sm text-slate-400">Memuat...</p>;
        if (!items.length) return <p className="text-sm text-slate-400">Belum ada barang.</p>;
        if (!list.length) return <p className="text-sm text-slate-400">Tidak ada barang yang cocok.</p>;
        return list.map((o) => (
          <div key={o.id} className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-2.5">
            <div className="flex min-w-0 items-center gap-2">
              {canDelete && <Checkbox checked={selected.has(o.id)} onCheckedChange={() => toggle(o.id)} />}
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{o.name}</p>
                <p className="truncate text-xs text-slate-400">Satuan: {o.satuan || "-"}</p>
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
        <DialogHeader><DialogTitle>{editing ? "Edit Barang" : "Tambah Barang"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <label className="block text-sm font-medium">Nama Barang<input value={name} onChange={(e) => setName(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" /></label>
          <label className="block text-sm font-medium">Satuan<input value={satuan} onChange={(e) => setSatuan(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" /></label>
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
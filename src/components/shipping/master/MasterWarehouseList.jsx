import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Pencil, Warehouse as WarehouseIcon } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import ConfirmDeleteDialog from "./ConfirmDeleteDialog";

export default function MasterWarehouseList({ canDelete, canEdit, canAdd = true }) {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({ queryKey: ["warehouses"], queryFn: () => base44.entities.Warehouse.list() });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState("");
  const [pic, setPic] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(new Set());
  const [confirmId, setConfirmId] = useState(null);
  const [confirmBulk, setConfirmBulk] = useState(false);
  const refresh = () => qc.invalidateQueries({ queryKey: ["warehouses"] });

  const openAdd = () => { setEditing(null); setName(""); setPic(""); setError(""); setOpen(true); };
  const openEdit = (w) => { setEditing(w); setName(w.name); setPic(w.pic || ""); setError(""); setOpen(true); };

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) { setError("Nama gudang wajib diisi."); return; }
    const dup = data.some((w) => w.name.toLowerCase() === trimmed.toLowerCase() && w.id !== editing?.id);
    if (dup) { setError("Gudang sudah ada."); return; }
    setBusy(true); setError("");
    try {
      if (editing) await base44.entities.Warehouse.update(editing.id, { name: trimmed, pic: pic.trim() });
      else await base44.entities.Warehouse.create({ name: trimmed, pic: pic.trim() });
      setName(""); setPic(""); setEditing(null); setOpen(false); refresh();
    } catch { setError("Gagal menyimpan gudang."); }
    finally { setBusy(false); }
  };
  const remove = async (id) => { setBusy(true); try { await base44.entities.Warehouse.delete(id); setSelected((p) => { const n = new Set(p); n.delete(id); return n; }); refresh(); } finally { setBusy(false); } };
  const removeMany = async () => {
    const ids = [...selected];
    setConfirmBulk(false);
    if (!ids.length) return;
    setBusy(true);
    try { await base44.entities.Warehouse.deleteMany({ id: { $in: ids } }); setSelected(new Set()); refresh(); }
    finally { setBusy(false); }
  };
  const toggle = (id) => setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allSelected = data.length > 0 && selected.size === data.length;
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(data.map((w) => w.id)));

  return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2"><WarehouseIcon className="h-5 w-5 text-indigo-600" /><h2 className="text-lg font-bold">Daftar Gudang</h2></div>
      {canAdd && <button onClick={openAdd} className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"><Plus className="h-4 w-4" />Tambah</button>}
    </div>
    {canDelete && data.length > 0 && <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
      <label className="flex items-center gap-2 text-sm font-medium text-slate-600"><Checkbox checked={allSelected} onCheckedChange={toggleAll} />Pilih Semua</label>
      {selected.size > 0 && <button onClick={() => setConfirmBulk(true)} disabled={busy} className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" />Hapus Terpilih ({selected.size})</button>}
    </div>}
    <div className="mt-4 space-y-2">
      {isLoading ? <p className="text-sm text-slate-400">Memuat...</p> : !data.length ? <p className="text-sm text-slate-400">Belum ada gudang.</p> :
        [...data].sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "id", { sensitivity: "base" })).map((w) => (
          <div key={w.id} className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-2.5">
            <div className="flex min-w-0 items-center gap-2">
              {canDelete && <Checkbox checked={selected.has(w.id)} onCheckedChange={() => toggle(w.id)} />}
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{w.name}</p>
                {w.pic && <p className="truncate text-xs text-slate-400">PIC: {w.pic}</p>}
              </div>
            </div>
            <div className="flex items-center gap-1">
              {canEdit && <button onClick={() => openEdit(w)} disabled={busy} className="rounded-lg p-1.5 text-slate-600 transition hover:bg-slate-100"><Pencil className="h-4 w-4" /></button>}
              {canDelete && <button onClick={() => setConfirmId(w.id)} disabled={busy} className="rounded-lg p-1.5 text-red-600 transition hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>}
            </div>
          </div>
        ))}
    </div>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader><DialogTitle>{editing ? "Edit Gudang" : "Tambah Gudang"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <label className="block text-sm font-medium">Nama Gudang<input value={name} onChange={(e) => setName(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" /></label>
          <label className="block text-sm font-medium">PIC Gudang<input value={pic} onChange={(e) => setPic(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" /></label>
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
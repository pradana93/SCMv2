import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Truck } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import ConfirmDeleteDialog from "@/components/shipping/master/ConfirmDeleteDialog";

const inputClass = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";

export default function MasterFleetList({ canAdd, canEdit, canDelete }) {
  const qc = useQueryClient();
  const { data: fleets = [], isLoading } = useQuery({ queryKey: ["fleets"], queryFn: () => base44.entities.Fleet.list() });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState("");
  const [plate, setPlate] = useState("");
  const [contact, setContact] = useState("");
  const [confirmId, setConfirmId] = useState(null);
  const [confirmBulk, setConfirmBulk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState(new Set());

  const refresh = () => qc.invalidateQueries({ queryKey: ["fleets"] });

  const openAdd = () => { setEditing(null); setName(""); setPlate(""); setContact(""); setDialogOpen(true); };
  const openEdit = (f) => { setEditing(f); setName(f.name || ""); setPlate(f.plate || ""); setContact(f.contact || ""); setDialogOpen(true); };

  const save = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      if (editing) await base44.entities.Fleet.update(editing.id, { name: name.trim(), plate: plate.trim(), contact: contact.trim() });
      else await base44.entities.Fleet.create({ name: name.trim(), plate: plate.trim(), contact: contact.trim() });
      setDialogOpen(false); refresh();
    } finally { setBusy(false); }
  };

  const doDelete = async () => {
    const id = confirmId;
    setConfirmId(null);
    if (!id) return;
    setBusy(true);
    try { await base44.entities.Fleet.delete(id); refresh(); } finally { setBusy(false); }
  };

  const doBulkDelete = async () => {
    setConfirmBulk(false);
    if (!selected.size) return;
    setBusy(true);
    try {
      for (const id of selected) { await base44.entities.Fleet.delete(id); }
      setSelected(new Set());
      refresh();
    } finally { setBusy(false); }
  };

  const toggleSelect = (id) => setSelected((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleSelectAll = () => setSelected((prev) => { if (prev.size === sorted.length) return new Set(); return new Set(sorted.map((f) => f.id)); });

  const sorted = [...fleets].sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "id"));

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2"><Truck className="h-5 w-5 text-indigo-600" /><h2 className="text-lg font-bold">Master Armada</h2></div>
        {canAdd && <button onClick={openAdd} className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"><Plus className="h-4 w-4" />Tambah</button>}
      </div>
      <p className="mt-1 text-xs text-slate-500">Daftar armada pengiriman. Digunakan sebagai pilihan armada di Delivery Order.</p>

      {canDelete && sorted.length > 0 && (
        <div className="mt-3 flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <Checkbox checked={selected.size === sorted.length && sorted.length > 0} onCheckedChange={toggleSelectAll} />
            Pilih Semua
          </label>
          {selected.size > 0 && (
            <button onClick={() => setConfirmBulk(true)} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700 disabled:opacity-60">
              <Trash2 className="h-3.5 w-3.5" />Hapus ({selected.size})
            </button>
          )}
        </div>
      )}

      <div className="mt-4 space-y-2">
        {isLoading ? <p className="py-4 text-center text-sm text-slate-400">Memuat data...</p> :
        sorted.length === 0 ? <p className="py-4 text-center text-sm text-slate-400">Belum ada armada.</p> :
        sorted.map((f) => (
          <div key={f.id} className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 px-3 py-2.5">
            <div className="flex items-center gap-2 min-w-0">
              {canDelete && <Checkbox checked={selected.has(f.id)} onCheckedChange={() => toggleSelect(f.id)} />}
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-800">{f.name}</p>
                {f.plate && <p className="truncate text-xs text-slate-400">Plat: {f.plate}</p>}
                {f.contact && <p className="truncate text-xs text-slate-400">{f.contact}</p>}
              </div>
            </div>
            <div className="flex items-center gap-1">
              {canEdit && <button onClick={() => openEdit(f)} className="rounded-lg p-1.5 text-slate-600 transition hover:bg-slate-100" title="Edit"><Pencil className="h-3.5 w-3.5" /></button>}
              {canDelete && <button onClick={() => setConfirmId(f.id)} className="rounded-lg p-1.5 text-red-600 transition hover:bg-red-50" title="Hapus"><Trash2 className="h-3.5 w-3.5" /></button>}
            </div>
          </div>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={(o) => !o && setDialogOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{editing ? "Edit Armada" : "Tambah Armada"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <label className="block text-sm font-medium">Nama Armada<input value={name} onChange={(e) => setName(e.target.value)} className={`mt-1.5 ${inputClass}`} placeholder="Nama armada / kendaraan" /></label>
            <label className="block text-sm font-medium">No. Plat (opsional)<input value={plate} onChange={(e) => setPlate(e.target.value)} className={`mt-1.5 ${inputClass}`} placeholder="Contoh: B 1234 XYZ" /></label>
            <label className="block text-sm font-medium">Kontak (opsional)<input value={contact} onChange={(e) => setContact(e.target.value)} className={`mt-1.5 ${inputClass}`} placeholder="No. telp / driver" /></label>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>Batal</Button><Button onClick={save} disabled={busy || !name.trim()}>{busy ? "Menyimpan..." : "Simpan"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDeleteDialog open={!!confirmId} onClose={() => setConfirmId(null)} onConfirm={doDelete} />
      <ConfirmDeleteDialog open={confirmBulk} onClose={() => setConfirmBulk(false)} onConfirm={doBulkDelete} count={selected.size} />
    </div>
  );
}
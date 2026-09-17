import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Building2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import ConfirmDeleteDialog from "@/components/shipping/master/ConfirmDeleteDialog";

const inputClass = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";

export default function MasterVendorList({ canAdd, canEdit, canDelete }) {
  const qc = useQueryClient();
  const { data: vendors = [], isLoading } = useQuery({ queryKey: ["vendors"], queryFn: () => base44.entities.Vendor.list() });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [confirmId, setConfirmId] = useState(null);
  const [confirmBulk, setConfirmBulk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState(new Set());

  const refresh = () => qc.invalidateQueries({ queryKey: ["vendors"] });

  const openAdd = () => { setEditing(null); setName(""); setContact(""); setDialogOpen(true); };
  const openEdit = (v) => { setEditing(v); setName(v.name || ""); setContact(v.contact || ""); setDialogOpen(true); };

  const save = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      if (editing) await base44.entities.Vendor.update(editing.id, { name: name.trim(), contact: contact.trim() });
      else await base44.entities.Vendor.create({ name: name.trim(), contact: contact.trim() });
      setDialogOpen(false); refresh();
    } finally { setBusy(false); }
  };

  const doDelete = async () => {
    const id = confirmId;
    setConfirmId(null);
    if (!id) return;
    setBusy(true);
    try { await base44.entities.Vendor.delete(id); refresh(); } finally { setBusy(false); }
  };

  const doBulkDelete = async () => {
    setConfirmBulk(false);
    if (!selected.size) return;
    setBusy(true);
    try {
      for (const id of selected) { await base44.entities.Vendor.delete(id); }
      setSelected(new Set());
      refresh();
    } finally { setBusy(false); }
  };

  const toggleSelect = (id) => {
    setSelected((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  };
  const toggleSelectAll = () => {
    setSelected((prev) => { if (prev.size === sorted.length) return new Set(); return new Set(sorted.map((v) => v.id)); });
  };

  const sorted = [...vendors].sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "id"));

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2"><Building2 className="h-5 w-5 text-indigo-600" /><h2 className="text-lg font-bold">Kartu Nama Vendor</h2></div>
        {canAdd && <button onClick={openAdd} className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"><Plus className="h-4 w-4" />Tambah</button>}
      </div>
      <p className="mt-1 text-xs text-slate-500">Daftar vendor/pengirim barang. Otomatis bertambah saat membuat rencana kedatangan baru.</p>

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
        sorted.length === 0 ? <p className="py-4 text-center text-sm text-slate-400">Belum ada vendor.</p> :
        sorted.map((v) => (
          <div key={v.id} className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 px-3 py-2.5">
            <div className="flex items-center gap-2 min-w-0">
              {canDelete && <Checkbox checked={selected.has(v.id)} onCheckedChange={() => toggleSelect(v.id)} />}
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-800">{v.name}</p>
                {v.contact && <p className="truncate text-xs text-slate-400">{v.contact}</p>}
              </div>
            </div>
            <div className="flex items-center gap-1">
              {canEdit && <button onClick={() => openEdit(v)} className="rounded-lg p-1.5 text-slate-600 transition hover:bg-slate-100" title="Edit"><Pencil className="h-3.5 w-3.5" /></button>}
              {canDelete && <button onClick={() => setConfirmId(v.id)} className="rounded-lg p-1.5 text-red-600 transition hover:bg-red-50" title="Hapus"><Trash2 className="h-3.5 w-3.5" /></button>}
            </div>
          </div>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={(o) => !o && setDialogOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{editing ? "Edit Vendor" : "Tambah Vendor"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <label className="block text-sm font-medium">Nama Vendor<input value={name} onChange={(e) => setName(e.target.value)} className={`mt-1.5 ${inputClass}`} placeholder="Nama vendor / pengirim" /></label>
            <label className="block text-sm font-medium">Kontak (opsional)<input value={contact} onChange={(e) => setContact(e.target.value)} className={`mt-1.5 ${inputClass}`} placeholder="No. telp / alamat" /></label>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>Batal</Button><Button onClick={save} disabled={busy || !name.trim()}>{busy ? "Menyimpan..." : "Simpan"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDeleteDialog open={!!confirmId} onClose={() => setConfirmId(null)} onConfirm={doDelete} />
      <ConfirmDeleteDialog open={confirmBulk} onClose={() => setConfirmBulk(false)} onConfirm={doBulkDelete} count={selected.size} />
    </div>
  );
}
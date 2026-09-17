import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Trash2, Package } from "lucide-react";
import UnitEditor from "@/components/shipping/UnitEditor";

const inputClass = "mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";

let rowIdCounter = 0;
const genRowId = () => `sit-${++rowIdCounter}`;

export default function StockItemReviewDialog({ open, items, onClose, onSubmit }) {
  const [rows, setRows] = useState([]);
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);

  useEffect(() => {
    if (open && items?.length) {
      setRows(items.map((d) => ({
        ...d,
        units: Array.isArray(d.units) && d.units.length > 0
          ? d.units
          : [{ name: d.unit || "", conversion: 1, is_base: true }],
        warehouses: Array.isArray(d.warehouses) ? d.warehouses : (typeof d.warehouses === "string" ? d.warehouses.split(",").map((w) => w.trim()).filter(Boolean) : []),
        _rid: genRowId(),
      })));
    }
  }, [open, items]);

  const update = (idx, field, value) => setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
  const removeRow = (idx) => setRows((prev) => prev.filter((_, i) => i !== idx));
  const confirmDelete = () => { if (pendingDelete !== null) { removeRow(pendingDelete); setPendingDelete(null); } };

  const submit = async () => {
    setSaving(true);
    try {
      const payload = rows.map((r) => {
        const cleanUnits = (r.units || []).filter((u) => u.name && u.name.trim());
        const base = cleanUnits.find((u) => u.is_base) || cleanUnits[0] || {};
        const units = cleanUnits.map((u) => ({
          name: u.name.trim(),
          conversion: Number(u.conversion) || 1,
          is_base: u === base,
        }));
        return {
          name: r.name,
          code: r.code || "",
          unit: base.name || r.unit || "",
          units,
          gramasi: Number(r.gramasi) || 0,
          min_stock: Number(r.min_stock) || 0,
          category: r.category || "",
          warehouses: Array.isArray(r.warehouses) ? r.warehouses : [],
        };
      });
      await onSubmit(payload);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Pratinjau Impor Daftar Barang</DialogTitle>
            <p className="text-sm text-slate-500">{rows.length} barang terbaca. Periksa data berikut sebelum disimpan. Anda dapat menghapus baris yang tidak diperlukan.</p>
          </DialogHeader>

          {rows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-500">
              Tidak ada barang valid terbaca. Pastikan format sesuai template.
            </div>
          ) : (
            <div className="space-y-3">
              {rows.map((r, idx) => (
                <div key={r._rid} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Package className="h-4 w-4 shrink-0 text-indigo-500" />
                      <input value={r.name} onChange={(e) => update(idx, "name", e.target.value)} className="flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm font-semibold outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" placeholder="Nama barang" />
                    </div>
                    <button type="button" onClick={() => setPendingDelete(idx)} disabled={saving} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <label className="text-xs font-medium text-slate-600">Kode<input value={r.code} onChange={(e) => update(idx, "code", e.target.value)} className={inputClass} placeholder="Kode" /></label>
                    <label className="text-xs font-medium text-slate-600">Gramasi (kg)<input type="number" min="0" step="0.1" value={r.gramasi} onChange={(e) => update(idx, "gramasi", e.target.value)} className={inputClass} placeholder="0" /></label>
                    <label className="text-xs font-medium text-slate-600">Min Stok<input type="number" min="0" value={r.min_stock} onChange={(e) => update(idx, "min_stock", e.target.value)} className={inputClass} placeholder="0" /></label>
                  </div>
                  <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50/50 p-3">
                    <p className="mb-2 text-xs font-semibold text-slate-600">Satuan & Konversi</p>
                    <UnitEditor units={r.units} onChange={(units) => update(idx, "units", units)} disabled={saving} />
                  </div>
                  <label className="mt-3 block text-xs font-medium text-slate-600">Kategori<input value={r.category} onChange={(e) => update(idx, "category", e.target.value)} className={inputClass} placeholder="Kategori" /></label>
                  <label className="mt-3 block text-xs font-medium text-slate-600">Gudang (pisahkan dengan koma, kosongkan untuk semua)<input value={(r.warehouses || []).join(", ")} onChange={(e) => update(idx, "warehouses", e.target.value.split(",").map((w) => w.trim()).filter(Boolean))} className={inputClass} placeholder="Contoh: Gudang Jakarta, Gudang Surabaya" /></label>
                </div>
              ))}
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={onClose} disabled={saving}>Batal</Button>
            <Button onClick={submit} disabled={saving || !rows.length} className="bg-indigo-600 text-white hover:bg-indigo-700">{saving ? "Menyimpan..." : `Simpan ${rows.length} Barang`}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={pendingDelete !== null} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus barang ini?</AlertDialogTitle>
            <AlertDialogDescription>Anda yakin ingin menghapus? Data ini akan dihapus dari daftar impor dan tidak akan disimpan.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">Ya, Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
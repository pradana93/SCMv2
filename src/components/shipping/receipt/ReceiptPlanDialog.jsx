import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Trash2, UserPlus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import WarehouseSelect from "@/components/shipping/WarehouseSelect";
import QuickAddVendorDialog from "@/components/shipping/receipt/QuickAddVendorDialog";
import { base44 } from "@/api/base44Client";
import { useStockCurrent } from "@/components/shipping/useStockCurrent";
import { convertToBase } from "@/components/shipping/unitConversion";
import FormSelect from "@/components/shipping/FormSelect";

const inputClass = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";
const today = () => new Date().toISOString().slice(0, 10);
const norm = (s) => (s || "").trim().toLowerCase();

export default function ReceiptPlanDialog({ open, onClose, onSave, editing, busy, canAddVendor }) {
  const { unitsFor, items, gramasiFor, calcTonnage } = useStockCurrent();
  const { data: vendors = [] } = useQuery({ queryKey: ["vendors"], queryFn: () => base44.entities.Vendor.list() });
  const [arrivalDate, setArrivalDate] = useState(today());
  const [warehouse, setWarehouse] = useState("Gudang Jakarta");
  const [sender, setSender] = useState("");
  const [note, setNote] = useState("");
  const [rows, setRows] = useState([{ item_name: "", quantity: "", unit: "", tonnage: "", note: "" }]);
  const [vendorAddOpen, setVendorAddOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setArrivalDate(editing.arrival_date || today());
      setWarehouse(editing.warehouse || "Gudang Jakarta");
      setSender(editing.sender_name || "");
      setNote(editing.note || "");
      setRows(Array.isArray(editing.items) && editing.items.length ? editing.items.map((it) => ({ item_name: it.item_name || "", quantity: String(it.quantity ?? ""), unit: it.unit || "", tonnage: String(it.tonnage ?? ""), note: it.note || "" })) : [{ item_name: "", quantity: "", unit: "", tonnage: "", note: "" }]);
    } else {
      setArrivalDate(today()); setWarehouse("Gudang Jakarta"); setSender(""); setNote("");
      setRows([{ item_name: "", quantity: "", unit: "", note: "" }]);
    }
  }, [open, editing]);

  const sortedItems = useMemo(() => [...(items || [])].sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "id")), [items]);
  const vendorNames = useMemo(() => vendors.map((v) => v.name).sort((a, b) => a.localeCompare(b, "id")), [vendors]);
  const vendorExists = useMemo(() => vendorNames.some((v) => norm(v) === norm(sender)), [vendorNames, sender]);
  const isVendorNew = sender.trim().length > 0 && !vendorExists;

  const setRow = (i, field, value) => setRows((p) => p.map((r, idx) => {
    if (idx !== i) return r;
    const next = { ...r, [field]: value };
    if (field === "unit") { const t = calcRowTonnage(r.item_name, value, r.quantity); if (t != null) next.tonnage = t; }
    return next;
  }));
  const calcRowTonnage = (name, unit, qty) => {
    const g = gramasiFor(name);
    if (g <= 0 || !unit) return null;
    const item = (items || []).find((it) => norm(it.name) === norm(name));
    const baseQty = convertToBase(item, Number(qty) || 0, unit);
    return g * baseQty;
  };
  const setQty = (i, value) => setRows((p) => p.map((r, idx) => { if (idx !== i) return r; const t = calcRowTonnage(r.item_name, r.unit, value); return { ...r, quantity: value, tonnage: t != null ? t : r.tonnage }; }));
  const onItem = (i, name) => {
    const unitList = unitsFor(name);
    const baseU = unitList.find((u) => u.is_base) || unitList[0];
    setRows((p) => p.map((r, idx) => {
      if (idx !== i) return r;
      const u = baseU?.name || "";
      const t = calcRowTonnage(name, u, r.quantity);
      return { ...r, item_name: name, unit: u, tonnage: t != null ? t : r.tonnage };
    }));
  };
  const addRow = () => setRows((p) => [...p, { item_name: "", quantity: "", unit: "", tonnage: "", note: "" }]);
  const removeRow = (i) => setRows((p) => p.filter((_, idx) => idx !== i));

  const totalTonnage = rows.reduce((sum, r) => sum + (Number(r.tonnage) || 0), 0);

  const submit = () => {
    if (!arrivalDate || !warehouse || !sender.trim()) return;
    const validRows = rows.filter((r) => r.item_name.trim() && Number(r.quantity) > 0);
    if (!validRows.length) return;
    if (validRows.some((r) => !r.unit.trim())) return;
    onSave({
      arrival_date: arrivalDate,
      warehouse,
      sender_name: sender.trim(),
      note: note.trim(),
      items: validRows.map((r) => ({ item_name: r.item_name.trim(), quantity: Number(r.quantity) || 0, unit: r.unit.trim(), tonnage: Number(r.tonnage) || 0, note: r.note.trim() })),
      status: editing?.status || "rencana",
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{editing ? "Edit Rencana Kedatangan" : "Tambah Rencana Kedatangan"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-medium">Tanggal Kedatangan<input type="date" value={arrivalDate} onChange={(e) => setArrivalDate(e.target.value)} className={`mt-1.5 ${inputClass}`} /></label>
            <label className="block text-sm font-medium">Gudang<div className="mt-1.5"><WarehouseSelect value={warehouse} onChange={setWarehouse} className="w-full" /></div></label>
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium">Nama Pengirim (Vendor)</label>
              {canAddVendor && <button type="button" onClick={() => setVendorAddOpen(true)} className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700"><UserPlus className="h-3.5 w-3.5" />Tambah Vendor Baru</button>}
            </div>
            <FormSelect value={sender || undefined} onValueChange={setSender} placeholder="Pilih vendor" options={vendorNames.map((v) => ({value: v, label: v}))} className={`mt-1.5 ${inputClass}`} />
            {isVendorNew && canAddVendor && <p className="mt-1 text-[11px] text-emerald-600">Vendor baru akan tersimpan ke Master Data saat disimpan.</p>}
            {isVendorNew && !canAddVendor && <p className="mt-1 text-[11px] text-rose-500">Vendor belum terdaftar. Hubungi admin untuk menambahkan vendor baru.</p>}
          </div>
          <div>
            <p className="mb-1.5 text-sm font-medium">Daftar Barang</p>
            <p className="mb-2 text-[11px] text-slate-400">Pilih barang dari daftar. Satuan otomatis terisi dari master barang.</p>
            <div className="space-y-2">
              {rows.map((r, i) => {
                const unitList = unitsFor(r.item_name);
                return (
                <div key={i} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex items-start gap-2">
                    <FormSelect value={r.item_name || undefined} onValueChange={(v) => onItem(i, v)} placeholder="Pilih barang" options={sortedItems.map((it) => ({value: it.name, label: it.name}))} className={`flex-1 ${inputClass}`} />
                    {rows.length > 1 && <button type="button" onClick={() => removeRow(i)} className="mt-0.5 rounded-lg p-2 text-red-600 transition hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>}
                  </div>
                  {r.item_name && (
                    <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-500">
                      <span>Satuan tersedia: <span className="font-semibold text-slate-700">{unitList.map((u) => u.name).join(", ") || "-"}</span></span>
                      {Number(gramasiFor(r.item_name)) > 0 && <span>Gramasi: <span className="font-semibold text-slate-700">{Number(gramasiFor(r.item_name)).toLocaleString("id-ID")} kg/satuan dasar</span></span>}
                    </div>
                  )}
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <label className="text-xs font-medium">Kuantitas<input type="number" min="0" value={r.quantity} onChange={(e) => setQty(i, e.target.value)} className={`mt-1 ${inputClass}`} placeholder="0" /></label>
                    <label className="text-xs font-medium">Satuan
                      <FormSelect value={r.unit || undefined} onValueChange={(v) => setRow(i, "unit", v)} placeholder="Pilih satuan" options={unitList.map((u) => ({value: u.name, label: u.name}))} className={`mt-1 ${inputClass}`} disabled={!r.item_name} />
                    </label>
                    <label className="text-xs font-medium">Tonase (kg)<input type="number" min="0" value={r.tonnage} onChange={(e) => setRow(i, "tonnage", e.target.value)} className={`mt-1 ${inputClass}`} placeholder="0" /></label>
                    <label className="text-xs font-medium sm:col-span-1 col-span-2">Keterangan<input value={r.note} onChange={(e) => setRow(i, "note", e.target.value)} className={`mt-1 ${inputClass}`} placeholder="Catatan (opsional)" /></label>
                  </div>
                </div>
                );
              })}
            </div>
            <button type="button" onClick={addRow} className="mt-2 inline-flex items-center gap-1.5 rounded-xl border border-dashed border-slate-300 px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"><Plus className="h-4 w-4" />Tambah Baris Barang</button>
            <p className="mt-2 text-sm font-semibold text-slate-600">Total Tonase: <span className="text-indigo-600">{totalTonnage.toLocaleString("id-ID")} kg</span></p>
          </div>
          <label className="block text-sm font-medium">Keterangan Umum<input value={note} onChange={(e) => setNote(e.target.value)} className={`mt-1.5 ${inputClass}`} placeholder="Catatan umum (opsional)" /></label>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Batal</Button><Button onClick={submit} disabled={busy || !arrivalDate || !warehouse || !sender.trim() || !rows.some((r) => r.item_name.trim() && Number(r.quantity) > 0) || rows.some((r) => r.item_name.trim() && Number(r.quantity) > 0 && !r.unit.trim())}>{busy ? "Menyimpan..." : "Simpan"}</Button></DialogFooter>
      </DialogContent>
      <QuickAddVendorDialog open={vendorAddOpen} onClose={() => setVendorAddOpen(false)} onAdded={setSender} />
    </Dialog>
  );
}
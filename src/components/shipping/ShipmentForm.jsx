import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Package, Calculator, Trash2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { today, WAREHOUSES } from "./shippingUtils";
import { useStockCurrent } from "@/components/shipping/useStockCurrent";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const buildInitial = (warehouse, prefill) => ({
  outlet_name: prefill?.outlet_name || "",
  tonnage: prefill?.tonnage ?? "",
  status: "menunggu_antrian",
  fleet: prefill?.fleet || "",
  delivery_date: prefill?.delivery_date || today(),
  warehouse,
  do_number: prefill?.do_number || "",
  do_items: prefill?.do_items || [],
});

export default function ShipmentForm({ onSubmit, defaultWarehouse = WAREHOUSES[0], onCancel, prefill }) {
  const [form, setForm] = useState(() => buildInitial(defaultWarehouse, prefill));
  useEffect(() => { setForm((f) => ({ ...f, warehouse: defaultWarehouse })); }, [defaultWarehouse]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [newItem, setNewItem] = useState({ name: "", unit: "", quantity: "" });
  const { data: warehouses = [] } = useQuery({ queryKey: ["warehouses"], queryFn: () => base44.entities.Warehouse.list() });
  const warehouseOptions = (warehouses.length ? warehouses.map((w) => w.name) : WAREHOUSES).slice().sort((a, b) => a.localeCompare(b, "id"));
  const { data: outlets = [] } = useQuery({ queryKey: ["outlets"], queryFn: () => base44.entities.Outlet.list() });
  const outletOptions = outlets.map((o) => o.name).slice().sort((a, b) => a.localeCompare(b, "id"));
  const { data: fleets = [] } = useQuery({ queryKey: ["fleets"], queryFn: () => base44.entities.Fleet.list() });
  const fleetOptions = fleets.map((f) => f.name).slice().sort((a, b) => a.localeCompare(b, "id"));
  const { calcTonnage, items, unitsFor } = useStockCurrent();
  const autoTonnage = calcTonnage(form.do_items);
  useEffect(() => { if (Array.isArray(form.do_items) && form.do_items.length && !form.tonnage) setForm((f) => ({ ...f, tonnage: autoTonnage })); }, [autoTonnage]);

  const sortedItems = useMemo(() => [...(items || [])].sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "id")), [items]);
  const newItemUnits = unitsFor(newItem.name);

  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const onNewItemName = (name) => {
    const ul = unitsFor(name);
    const baseU = ul.find((u) => u.is_base) || ul[0];
    setNewItem((p) => ({ ...p, name, unit: baseU?.name || "" }));
  };
  const addItem = () => {
    if (!newItem.name || !newItem.unit || !Number(newItem.quantity)) return;
    setForm((f) => ({ ...f, do_items: [...(f.do_items || []), { name: newItem.name, quantity: Number(newItem.quantity), unit: newItem.unit }] }));
    setNewItem({ name: "", unit: "", quantity: "" });
  };
  const removeItem = (idx) => setForm((f) => ({ ...f, do_items: (f.do_items || []).filter((_, i) => i !== idx) }));
  const submit = async (e) => {
    e.preventDefault(); setSaving(true); setError("");
    try { await onSubmit({ ...form, tonnage: Number(form.tonnage), crew_count: 0, checker_name: "", do_items: form.do_items }); setForm(buildInitial(form.warehouse)); }
    catch { setError("Data gagal disimpan. Silakan coba lagi."); }
    finally { setSaving(false); }
  };
  const inputClass = "mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";
  const selectTriggerClass = "mt-1.5 h-auto w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";
  const hasItems = Array.isArray(form.do_items) && form.do_items.length > 0;
  return <form onSubmit={submit} className="space-y-4">
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="text-sm font-medium">Nomor DO<input name="do_number" value={form.do_number} onChange={change} className={inputClass} placeholder="Contoh: DO/2026/07/003141" /></label>
      <label className="text-sm font-medium">Tanggal Pengiriman<input required type="date" name="delivery_date" value={form.delivery_date} onChange={change} className={inputClass} /></label>
      <label className="text-sm font-medium">Gudang Asal
        <Select value={form.warehouse} onValueChange={(v) => setForm((f) => ({ ...f, warehouse: v }))}>
          <SelectTrigger className={selectTriggerClass}><SelectValue placeholder="Pilih gudang" /></SelectTrigger>
          <SelectContent>
            {warehouseOptions.map((w) => <SelectItem key={w} value={w}>{w}</SelectItem>)}
          </SelectContent>
        </Select>
      </label>
      <label className="text-sm font-medium">Outlet Tujuan
        <Select value={form.outlet_name} onValueChange={(v) => setForm((f) => ({ ...f, outlet_name: v }))}>
          <SelectTrigger className={selectTriggerClass}><SelectValue placeholder="Pilih outlet" /></SelectTrigger>
          <SelectContent>
            {outletOptions.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
          </SelectContent>
        </Select>
      </label>
      <label className="text-sm font-medium">Total Tonase (kg)<div className="mt-1.5 flex gap-1.5"><input required min="0" step="1" type="number" name="tonnage" value={form.tonnage} onChange={change} className="flex-1 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" placeholder="0" />{Array.isArray(form.do_items) && form.do_items.length > 0 && <button type="button" onClick={() => setForm((f) => ({ ...f, tonnage: autoTonnage }))} className="shrink-0 rounded-xl border border-indigo-200 bg-indigo-50 px-3 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100" title="Hitung dari gramasi master barang"><Calculator className="h-4 w-4" /></button>}</div></label>
      <label className="text-sm font-medium">Armada Pengiriman
        <Select value={form.fleet} onValueChange={(v) => setForm((f) => ({ ...f, fleet: v }))}>
          <SelectTrigger className={selectTriggerClass}><SelectValue placeholder="Pilih armada" /></SelectTrigger>
          <SelectContent>
            {fleetOptions.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
          </SelectContent>
        </Select>
      </label>
    </div>
    {hasItems && (
      <div className="rounded-xl border border-slate-200 p-3">
        <p className="mb-2 text-sm font-semibold text-slate-700">Item Pengiriman ({form.do_items.length})</p>
        <div className="space-y-1.5">
          {form.do_items.map((it, i) => (
            <div key={i} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
              <span className="font-medium text-slate-700">{it.name}</span>
              <div className="flex items-center gap-2">
                <span className="text-slate-500">{Number(it.quantity).toLocaleString("id-ID")} {it.unit}</span>
                <button type="button" onClick={() => removeItem(i)} className="rounded p-1 text-red-600 transition hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          ))}
        </div>
      </div>
    )}
    <div className="rounded-xl border border-dashed border-slate-300 p-3">
      <p className="mb-2 text-sm font-semibold text-slate-600">Tambah Item dari Daftar Barang</p>
      <div className="grid gap-2 sm:grid-cols-12">
        <Select value={newItem.name} onValueChange={onNewItemName}>
          <SelectTrigger className="sm:col-span-5 h-auto rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"><SelectValue placeholder="Pilih barang" /></SelectTrigger>
          <SelectContent>
            {sortedItems.map((it) => <SelectItem key={it.id} value={it.name}>{it.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={newItem.unit} onValueChange={(v) => setNewItem((p) => ({ ...p, unit: v }))} disabled={!newItem.name}>
          <SelectTrigger className="sm:col-span-3 h-auto rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"><SelectValue placeholder="Satuan" /></SelectTrigger>
          <SelectContent>
            {newItemUnits.map((u) => <SelectItem key={u.name} value={u.name}>{u.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <input type="number" min="0" value={newItem.quantity} onChange={(e) => setNewItem((p) => ({ ...p, quantity: e.target.value }))} className="sm:col-span-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" placeholder="Jumlah" disabled={!newItem.name} />
        <button type="button" onClick={addItem} disabled={!newItem.name || !newItem.unit || !Number(newItem.quantity)} className="sm:col-span-1 inline-flex items-center justify-center rounded-xl bg-indigo-600 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"><Plus className="h-4 w-4" /></button>
      </div>
    </div>
    {error && <p className="text-sm text-red-600">{error}</p>}
    <div className="flex justify-end gap-2 pt-1">
      {onCancel && <button type="button" onClick={onCancel} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">Batal</button>}
      <button disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"><Plus className="h-4 w-4" />{saving ? "Menyimpan..." : "Tambahkan Data"}</button>
    </div>
  </form>;
}
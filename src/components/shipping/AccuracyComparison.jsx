import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import WarehouseMultiSelect from "./WarehouseMultiSelect";
import { today } from "./shippingUtils";

const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

export default function AccuracyComparison() {
  const [start, setStart] = useState(daysAgo(6));
  const [end, setEnd] = useState(today());
  const [w, setW] = useState([]);
  const wq = w.length === 0 ? {} : { warehouse: { $in: w } };
  const { data = [], isLoading } = useQuery({
    queryKey: ["shipments", "comparison", start, end, w],
    queryFn: () => base44.entities.Shipment.filter({ delivery_date: { $gte: start, $lte: end }, ...wq }, "-delivery_date", 500),
  });
  const total = data.length;
  const komplain = data.filter((s) => s.accuracy === "ada_komplain").length;
  const tanpa = total - komplain;
  const persen = total ? Math.round((komplain / total) * 1000) / 10 : 0;
  const akurasiPersen = total ? Math.round((tanpa / total) * 1000) / 10 : 0;
  const maxBar = Math.max(total, 1);

  const inputClass = "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";

  return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
    <div className="flex flex-wrap items-end gap-3">
      <label className="text-sm font-medium">Gudang<div className="mt-1.5"><WarehouseMultiSelect value={w} onChange={setW} className="w-[180px]" /></div></label>
      <label className="text-sm font-medium">Dari<input type="date" max={end} value={start} onChange={(e) => setStart(e.target.value)} className={`mt-1.5 ${inputClass}`} /></label>
      <label className="text-sm font-medium">Sampai<input type="date" min={start} max={today()} value={end} onChange={(e) => setEnd(e.target.value)} className={`mt-1.5 ${inputClass}`} /></label>
    </div>

    <div className="mt-5 grid gap-4 sm:grid-cols-2">
      <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-5">
        <p className="text-sm font-medium text-indigo-600">Total Pengiriman</p>
        <p className="mt-1 text-3xl font-bold text-indigo-700">{isLoading ? "—" : total}</p>
      </div>
      <div className="rounded-2xl border border-rose-100 bg-rose-50/50 p-5">
        <p className="text-sm font-medium text-rose-600">Total Akurasi Komplain</p>
        <p className="mt-1 text-3xl font-bold text-rose-700">{isLoading ? "—" : komplain}</p>
      </div>
    </div>

    <div className="mt-5 space-y-3">
      <div>
        <div className="mb-1 flex items-center justify-between text-xs font-medium text-slate-500"><span>Total Pengiriman</span><span>{total}</span></div>
        <div className="h-3 w-full rounded-full bg-slate-100"><div className="h-3 rounded-full bg-indigo-600" style={{ width: `${(total / maxBar) * 100}%` }} /></div>
      </div>
      <div>
        <div className="mb-1 flex items-center justify-between text-xs font-medium text-slate-500"><span>Total Komplain</span><span>{komplain}</span></div>
        <div className="h-3 w-full rounded-full bg-slate-100"><div className="h-3 rounded-full bg-rose-600" style={{ width: `${(komplain / maxBar) * 100}%` }} /></div>
      </div>
      <div>
        <div className="mb-1 flex items-center justify-between text-xs font-medium text-slate-500"><span>Tanpa Komplain</span><span>{tanpa}</span></div>
        <div className="h-3 w-full rounded-full bg-slate-100"><div className="h-3 rounded-full bg-emerald-600" style={{ width: `${(tanpa / maxBar) * 100}%` }} /></div>
      </div>
    </div>

    <div className="mt-5 grid gap-3 sm:grid-cols-2">
      <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">Persentase Komplain: <span className="font-bold">{persen}%</span> dari total pengiriman</div>
      <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">Persentase Akurasi: <span className="font-bold">{akurasiPersen}%</span> tanpa komplain</div>
    </div>
  </div>;
}
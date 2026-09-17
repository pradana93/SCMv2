import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { BarChart3 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import WarehouseMultiSelect from "./WarehouseMultiSelect";
import { today } from "./shippingUtils";

const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return fmt(d); };
const shortDate = (s) => { const [y, m, d] = (s || "").split("-"); return m && d ? `${d}/${m}` : s; };

export default function DailyShipmentTrendChart() {
  const [start, setStart] = useState(daysAgo(6));
  const [end, setEnd] = useState(today());
  const [w, setW] = useState([]);
  const wq = w.length === 0 ? {} : { warehouse: { $in: w } };
  const { data = [], isLoading } = useQuery({ queryKey: ["shipments", "dailyTrend", start, end, w], queryFn: () => base44.entities.Shipment.filter({ delivery_date: { $gte: start, $lte: end }, ...wq }, "-delivery_date", 1000) });

  const chartData = useMemo(() => {
    const map = {};
    const s = new Date(start + "T00:00:00"); const e = new Date(end + "T00:00:00");
    for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) { map[fmt(d)] = { date: fmt(d), count: 0 }; }
    for (const sh of data) { const d = sh.delivery_date; if (d && map[d]) map[d].count += 1; }
    return Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
  }, [data, start, end]);

  const total = chartData.reduce((s, x) => s + x.count, 0);
  const inputClass = "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-center gap-2"><BarChart3 className="h-5 w-5 text-indigo-600" /><div><h2 className="text-sm font-bold text-slate-700">Tren Pengiriman Harian</h2><p className="text-xs text-slate-400">Jumlah pengiriman per tanggal · {total} pengiriman</p></div></div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm font-medium">Gudang<div className="mt-1.5"><WarehouseMultiSelect value={w} onChange={setW} className="w-[180px]" /></div></label>
          <label className="text-sm font-medium">Dari<input type="date" max={end} value={start} onChange={(e) => setStart(e.target.value)} className={`mt-1.5 ${inputClass}`} /></label>
          <label className="text-sm font-medium">Sampai<input type="date" min={start} max={today()} value={end} onChange={(e) => setEnd(e.target.value)} className={`mt-1.5 ${inputClass}`} /></label>
          <button onClick={() => { setStart(daysAgo(6)); setEnd(today()); }} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50">7 Hari Terakhir</button>
        </div>
      </div>
      <div className="mt-5 h-80">
        {isLoading ? <div className="flex h-full items-center justify-center"><div className="h-7 w-7 animate-spin rounded-full border-4 border-indigo-100 border-t-indigo-600" /></div>
          : chartData.length === 0 ? <div className="flex h-full flex-col items-center justify-center text-slate-400"><BarChart3 className="mb-2 h-8 w-8" /><p className="text-sm">Tidak ada data pada rentang ini</p></div>
          : <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 16, right: 16, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={shortDate} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip formatter={(v) => [`${v} pengiriman`, "Jumlah"]} labelFormatter={(l) => `Tanggal: ${l}`} />
              <Bar dataKey="count" name="Jumlah Pengiriman" radius={[6, 6, 0, 0]} fill="#6366f1" />
            </BarChart>
          </ResponsiveContainer>}
      </div>
    </div>
  );
}
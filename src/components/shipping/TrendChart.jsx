import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { TrendingUp } from "lucide-react";
import { base44 } from "@/api/base44Client";
import WarehouseMultiSelect from "./WarehouseMultiSelect";
import { today, formatTonnage } from "./shippingUtils";

const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

const durasiMenit = (item) => {
  const a = item.timestamp_proses_picking ? new Date(item.timestamp_proses_picking).getTime() : null;
  const b = item.timestamp_sudah_dikirim ? new Date(item.timestamp_sudah_dikirim).getTime() : null;
  if (!a || !b || b < a) return null;
  return Math.round(((b - a) / 60000) * 10) / 10;
};

export default function TrendChart() {
  const [start, setStart] = useState(daysAgo(6));
  const [end, setEnd] = useState(today());
  const [w, setW] = useState([]);
  const wq = w.length === 0 ? {} : { warehouse: { $in: w } };
  const { data = [], isLoading } = useQuery({
    queryKey: ["shipments", "trend", start, end, w],
    queryFn: () => base44.entities.Shipment.filter({ delivery_date: { $gte: start, $lte: end }, ...wq }, "-delivery_date", 500),
  });

  const chartData = useMemo(() => {
    const map = {};
    data.forEach((s) => {
      const d = s.delivery_date;
      if (!map[d]) map[d] = { date: d, tonnage: 0, durations: [] };
      map[d].tonnage += Number(s.tonnage || 0);
      const dm = durasiMenit(s);
      if (dm != null) map[d].durations.push(dm);
    });
    return Object.keys(map).sort().map((d) => ({
      date: d,
      tonnage: map[d].tonnage,
      avgDuration: map[d].durations.length ? Math.round((map[d].durations.reduce((a, b) => a + b, 0) / map[d].durations.length) * 10) / 10 : 0,
    }));
  }, [data]);

  const inputClass = "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";

  return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm font-medium">Gudang<div className="mt-1.5"><WarehouseMultiSelect value={w} onChange={setW} className="w-[180px]" /></div></label>
        <label className="text-sm font-medium">Dari<input type="date" max={end} value={start} onChange={(e) => setStart(e.target.value)} className={`mt-1.5 ${inputClass}`} /></label>
        <label className="text-sm font-medium">Sampai<input type="date" min={start} max={today()} value={end} onChange={(e) => setEnd(e.target.value)} className={`mt-1.5 ${inputClass}`} /></label>
      </div>
      <button onClick={() => { setStart(daysAgo(6)); setEnd(today()); }} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50">7 Hari Terakhir</button>
    </div>

    <div className="mt-5 h-80">
      {isLoading ? <div className="flex h-full items-center justify-center"><div className="h-7 w-7 animate-spin rounded-full border-4 border-indigo-100 border-t-indigo-600" /></div>
        : chartData.length === 0 ? <div className="flex h-full flex-col items-center justify-center text-slate-400"><TrendingUp className="mb-2 h-8 w-8" /><p className="text-sm">Tidak ada data pada rentang ini</p></div>
        : <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 16, right: 16, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="left" tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} unit=" mnt" />
            <Tooltip formatter={(v, name) => name === "Tonase" ? [formatTonnage(v), name] : [`${v} menit`, name]} labelFormatter={(label) => `Tanggal: ${label}`} />
            <Legend />
            <Bar yAxisId="left" dataKey="tonnage" name="Tonase" radius={[6, 6, 0, 0]} fill="#6366f1" />
            <Line yAxisId="right" type="monotone" dataKey="avgDuration" name="Rata-rata Durasi (menit)" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
          </ComposedChart>
        </ResponsiveContainer>}
    </div>
  </div>;
}
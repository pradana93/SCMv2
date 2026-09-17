import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from "recharts";
import { Truck } from "lucide-react";
import { formatTonnage } from "../shippingUtils";

export default function TopOutletChart({ data = [], isLoading }) {
  const map = {};
  data.forEach((s) => { const k = s.outlet_name || "Tanpa Nama"; map[k] = (map[k] || 0) + Number(s.tonnage || 0); });
  const top5 = Object.entries(map).map(([name, tonnage]) => ({ name, tonnage })).sort((a, b) => b.tonnage - a.tonnage).slice(0, 5);

  if (isLoading) return <div className="flex h-72 sm:h-80 items-center justify-center"><div className="h-7 w-7 animate-spin rounded-full border-4 border-indigo-100 border-t-indigo-600" /></div>;
  if (!top5.length) return <div className="flex h-72 sm:h-80 flex-col items-center justify-center text-slate-400"><Truck className="mb-2 h-8 w-8" /><p className="text-sm">Tidak ada data pada rentang ini</p></div>;
  return <div className="h-72 sm:h-80"><ResponsiveContainer width="100%" height="100%">
    <BarChart layout="vertical" data={top5} margin={{ left: 8, right: 48, top: 8, bottom: 8 }}>
      <CartesianGrid horizontal={false} stroke="#e2e8f0" />
      <XAxis type="number" tick={{ fontSize: 11 }} />
      <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 12 }} />
      <Tooltip formatter={(v) => [formatTonnage(v), "Total Tonase"]} labelFormatter={(label) => `Outlet: ${label}`} />
      <Bar dataKey="tonnage" radius={[0, 6, 6, 0]} fill="#6366f1">
        <LabelList dataKey="tonnage" position="right" formatter={(v) => formatTonnage(v)} style={{ fontSize: 11, fill: "#475569", fontWeight: 600 }} />
      </Bar>
    </BarChart>
  </ResponsiveContainer></div>;
}
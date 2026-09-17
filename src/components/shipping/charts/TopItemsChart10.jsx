import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList, Cell } from "recharts";
import { PackageCheck } from "lucide-react";

const CHART_COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ec4899", "#06b6d4", "#8b5cf6", "#ef4444", "#14b8a6", "#f97316", "#3b82f6"];

export default function TopItemsChart10({ data = [], isLoading }) {
  const top10 = useMemo(() => {
    const map = new Map();
    for (const s of data) {
      if (s.status !== "sudah_dikirim") continue;
      for (const it of (Array.isArray(s.do_items) ? s.do_items : [])) {
        const nm = (it?.name || "").trim() || "(tanpa nama)";
        const e = map.get(nm) || { name: nm, qty: 0 };
        e.qty += Number(it?.quantity || 0);
        map.set(nm, e);
      }
    }
    return [...map.values()].sort((a, b) => b.qty - a.qty).slice(0, 10);
  }, [data]);

  if (isLoading) return <div className="flex h-72 sm:h-80 items-center justify-center"><div className="h-7 w-7 animate-spin rounded-full border-4 border-indigo-100 border-t-indigo-600" /></div>;
  if (!top10.length) return <div className="flex h-72 sm:h-80 flex-col items-center justify-center text-slate-400"><PackageCheck className="mb-2 h-8 w-8" /><p className="text-sm">Belum ada pengiriman terkirim.</p></div>;
  return <div className="h-72 sm:h-80"><ResponsiveContainer width="100%" height="100%">
    <BarChart layout="vertical" data={top10} margin={{ left: 8, right: 40, top: 8, bottom: 8 }}>
      <CartesianGrid horizontal={false} stroke="#f1f5f9" />
      <XAxis type="number" tick={{ fontSize: 11, fill: "#64748b" }} />
      <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11, fill: "#475569" }} />
      <Tooltip cursor={{ fill: "#f8fafc" }} formatter={(v) => [Number(v).toLocaleString("id-ID"), "Kuantitas"]} />
      <Bar dataKey="qty" radius={[0, 6, 6, 0]}>
        {top10.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
        <LabelList dataKey="qty" position="right" formatter={(v) => Number(v).toLocaleString("id-ID")} style={{ fontSize: 11, fill: "#475569", fontWeight: 600 }} />
      </Bar>
    </BarChart>
  </ResponsiveContainer></div>;
}
import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, LabelList } from "recharts";
import { PackageCheck } from "lucide-react";

const CHART_COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ec4899", "#06b6d4"];

export default function TopItemsChart({ shipments = [] }) {
  const top5 = useMemo(() => {
    const map = new Map();
    for (const s of shipments) {
      if (s.status !== "sudah_dikirim") continue;
      for (const it of (Array.isArray(s.do_items) ? s.do_items : [])) {
        const nm = (it?.name || "").trim() || "(tanpa nama)";
        const e = map.get(nm) || { name: nm, qty: 0 };
        e.qty += Number(it?.quantity || 0);
        map.set(nm, e);
      }
    }
    return [...map.values()].sort((a, b) => b.qty - a.qty).slice(0, 5);
  }, [shipments]);

  return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
    <div className="flex items-center gap-2"><PackageCheck className="h-5 w-5 text-indigo-600" /><h2 className="text-lg font-bold">Top 5 Barang Terkirim</h2></div>
    <p className="mt-1 text-sm text-slate-500">Kuantitas barang dengan status Sudah Dikirim pada tanggal & gudang terpilih.</p>
    {top5.length === 0 ? <p className="mt-6 text-sm text-slate-400">Belum ada pengiriman terkirim.</p> :
      <div className="mt-5 h-72"><ResponsiveContainer width="100%" height="100%">
        <BarChart data={top5} layout="vertical" margin={{ left: 8, right: 40, top: 8, bottom: 8 }}>
          <CartesianGrid horizontal={false} stroke="#f1f5f9" />
          <XAxis type="number" tick={{ fontSize: 11, fill: "#64748b" }} />
          <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11, fill: "#475569" }} />
          <Tooltip cursor={{ fill: "#f8fafc" }} formatter={(v) => [Number(v).toLocaleString("id-ID"), "Kuantitas"]} />
          <Bar dataKey="qty" radius={[0, 6, 6, 0]}>
            {top5.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
            <LabelList dataKey="qty" position="right" formatter={(v) => Number(v).toLocaleString("id-ID")} style={{ fontSize: 11, fill: "#475569", fontWeight: 600 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer></div>}
  </div>;
}
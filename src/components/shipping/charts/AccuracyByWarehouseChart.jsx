import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from "recharts";
import { ShieldCheck } from "lucide-react";

export default function AccuracyByWarehouseChart({ data = [], isLoading }) {
  const chartData = useMemo(() => {
    const map = {};
    data.forEach((s) => {
      const w = s.warehouse || "Lainnya";
      if (!map[w]) map[w] = { name: w, total: 0, tanpa: 0 };
      map[w].total++;
      if (s.accuracy === "tanpa_komplain") map[w].tanpa++;
    });
    return Object.values(map).map((d) => ({ name: d.name, persen: d.total ? Math.round((d.tanpa / d.total) * 1000) / 10 : 0 }));
  }, [data]);

  if (isLoading) return <div className="flex h-72 sm:h-80 items-center justify-center"><div className="h-7 w-7 animate-spin rounded-full border-4 border-indigo-100 border-t-indigo-600" /></div>;
  if (!chartData.length) return <div className="flex h-72 sm:h-80 flex-col items-center justify-center text-slate-400"><ShieldCheck className="mb-2 h-8 w-8" /><p className="text-sm">Tidak ada data pada rentang ini</p></div>;
  return <div className="h-72 sm:h-80"><ResponsiveContainer width="100%" height="100%">
    <BarChart data={chartData} margin={{ top: 24, right: 16, left: 0, bottom: 8 }}>
      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
      <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} unit="%" />
      <Tooltip formatter={(v) => [`${v}%`, "Persentase Akurasi"]} labelFormatter={(label) => `Gudang: ${label}`} />
      <Bar dataKey="persen" radius={[6, 6, 0, 0]} fill="#10b981">
        <LabelList dataKey="persen" position="top" formatter={(v) => `${v}%`} style={{ fontSize: 12, fill: "#475569", fontWeight: 600 }} />
      </Bar>
    </BarChart>
  </ResponsiveContainer></div>;
}
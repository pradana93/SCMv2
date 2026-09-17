import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList, Cell } from "recharts";
import { BarChart3 } from "lucide-react";

export default function StatusComparisonChart({ data = [], isLoading }) {
  const sudahDikirim = data.filter((s) => s.status === "sudah_dikirim").length;
  const adaKomplain = data.filter((s) => s.accuracy === "ada_komplain").length;
  const tanpaKomplain = data.filter((s) => s.accuracy === "tanpa_komplain").length;
  const chartData = [
    { name: "Sudah Dikirim", value: sudahDikirim, fill: "#10b981" },
    { name: "Ada Komplain", value: adaKomplain, fill: "#f43f5e" },
    { name: "Tanpa Komplain", value: tanpaKomplain, fill: "#6366f1" },
  ];

  if (isLoading) return <div className="flex h-72 sm:h-80 items-center justify-center"><div className="h-7 w-7 animate-spin rounded-full border-4 border-indigo-100 border-t-indigo-600" /></div>;
  if (!data.length) return <div className="flex h-72 sm:h-80 flex-col items-center justify-center text-slate-400"><BarChart3 className="mb-2 h-8 w-8" /><p className="text-sm">Tidak ada data pada rentang ini</p></div>;
  return <div className="h-72 sm:h-80"><ResponsiveContainer width="100%" height="100%">
    <BarChart data={chartData} margin={{ top: 24, right: 16, left: 0, bottom: 8 }}>
      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
      <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
      <Tooltip formatter={(v) => [v, "Jumlah"]} />
      <Bar dataKey="value" radius={[6, 6, 0, 0]}>
        {chartData.map((d, i) => <Cell key={i} fill={d.fill} />)}
        <LabelList dataKey="value" position="top" style={{ fontSize: 12, fill: "#475569", fontWeight: 600 }} />
      </Bar>
    </BarChart>
  </ResponsiveContainer></div>;
}
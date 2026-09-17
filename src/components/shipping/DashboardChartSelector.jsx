import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { LayoutList } from "lucide-react";
import { base44 } from "@/api/base44Client";
import WarehouseMultiSelect from "./WarehouseMultiSelect";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { today, formatTonnage } from "./shippingUtils";

const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

const SUMMARY_OPTIONS = [
  { value: "top_outlet", label: "Top 5 Outlet (Tonase)" },
  { value: "top_items", label: "Top 10 Items" },
  { value: "top_checker", label: "Top 3 Checker" },
];

const Empty = () => <p className="py-8 text-center text-sm text-slate-400">Tidak ada data pada rentang ini.</p>;
const Loading = () => <div className="flex justify-center py-10"><div className="h-7 w-7 animate-spin rounded-full border-4 border-indigo-100 border-t-indigo-600" /></div>;

export default function DashboardChartSelector() {
  const [summaryType, setSummaryType] = useState("");
  const [start, setStart] = useState(daysAgo(6));
  const [end, setEnd] = useState(today());
  const [warehouse, setWarehouse] = useState([]);
  const wq = warehouse.length === 0 ? {} : { warehouse: { $in: warehouse } };
  const { data = [], isLoading } = useQuery({
    queryKey: ["shipments", "dashboard-summary", start, end, warehouse],
    queryFn: () => base44.entities.Shipment.filter({ delivery_date: { $gte: start, $lte: end }, ...wq }, "-created_date", 500),
    enabled: !!summaryType,
  });
  const inputClass = "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";

  const topOutlets = useMemo(() => {
    const map = new Map();
    for (const s of data) { const k = s.outlet_name || "(tanpa outlet)"; const e = map.get(k) || { outlet: k, tonnage: 0, count: 0 }; e.tonnage += Number(s.tonnage || 0); e.count += 1; map.set(k, e); }
    return [...map.values()].sort((a, b) => b.tonnage - a.tonnage).slice(0, 5);
  }, [data]);

  const accuracy = useMemo(() => {
    const total = data.length;
    const komplain = data.filter((s) => s.accuracy === "ada_komplain").length;
    const tanpa = data.filter((s) => s.accuracy === "tanpa_komplain").length;
    const pct = total > 0 ? Math.round(((total - komplain) / total) * 1000) / 10 : 0;
    return { total, komplain, tanpa, pct };
  }, [data]);

  const topItems = useMemo(() => {
    const map = new Map();
    for (const s of data.filter((s) => s.status === "sudah_dikirim")) {
      for (const it of (s.do_items || [])) { const k = (it.name || "").trim() || "(tanpa nama)"; const e = map.get(k) || { name: k, qty: 0 }; e.qty += Number(it.quantity || 0); map.set(k, e); }
    }
    return [...map.values()].sort((a, b) => b.qty - a.qty).slice(0, 10);
  }, [data]);

  const topCheckers = useMemo(() => {
    const map = new Map();
    for (const s of data.filter((s) => s.status === "sudah_dikirim")) {
      const k = (s.checker_name || "").trim() || "(tanpa checker)";
      const e = map.get(k) || { checker: k, tonnage: 0, count: 0 };
      e.tonnage += Number(s.tonnage || 0); e.count += 1; map.set(k, e);
    }
    return [...map.values()].sort((a, b) => b.count - a.count || b.tonnage - a.tonnage).slice(0, 3);
  }, [data]);

  const renderSummary = () => {
    if (!summaryType) return <div className="flex h-48 flex-col items-center justify-center text-slate-400"><LayoutList className="mb-2 h-8 w-8" /><p className="text-sm">Pilih Data</p></div>;
    if (isLoading) return <Loading />;
    switch (summaryType) {
      case "top_outlet":
        if (!topOutlets.length) return <Empty />;
        return <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500"><tr><th className="px-4 py-3">Peringkat</th><th className="px-4 py-3">Outlet</th><th className="px-4 py-3 text-right">Total Tonase</th><th className="px-4 py-3 text-right">Jumlah DO</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {topOutlets.map((r, i) => <tr key={i}><td className="px-4 py-3"><span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">{i + 1}</span></td><td className="px-4 py-3 font-medium">{r.outlet}</td><td className="px-4 py-3 text-right font-semibold">{formatTonnage(r.tonnage)}</td><td className="px-4 py-3 text-right text-slate-600">{r.count}</td></tr>)}
          </tbody>
        </table></div>;
      case "delivery_accuracy":
        return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs text-slate-500">Total Pengiriman</p><p className="mt-1 text-2xl font-bold text-slate-900">{accuracy.total}</p></div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 shadow-sm"><p className="text-xs text-slate-500">Tanpa Komplain</p><p className="mt-1 text-2xl font-bold text-emerald-600">{accuracy.tanpa}</p></div>
          <div className="rounded-xl border border-rose-200 bg-rose-50/40 p-4 shadow-sm"><p className="text-xs text-slate-500">Ada Komplain</p><p className="mt-1 text-2xl font-bold text-rose-600">{accuracy.komplain}</p></div>
          <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-4 shadow-sm"><p className="text-xs text-slate-500">Delivery Accuracy</p><p className="mt-1 text-2xl font-bold text-indigo-600">{accuracy.pct}%</p></div>
        </div>;
      case "top_items":
        if (!topItems.length) return <Empty />;
        return <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500"><tr><th className="px-4 py-3">Peringkat</th><th className="px-4 py-3">Nama Barang</th><th className="px-4 py-3 text-right">Total Kuantitas</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {topItems.map((r, i) => <tr key={i}><td className="px-4 py-3"><span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">{i + 1}</span></td><td className="px-4 py-3 font-medium">{r.name}</td><td className="px-4 py-3 text-right font-semibold">{r.qty}</td></tr>)}
          </tbody>
        </table></div>;
      case "top_checker":
        if (!topCheckers.length) return <Empty />;
        return <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500"><tr><th className="px-4 py-3">Peringkat</th><th className="px-4 py-3">Checker</th><th className="px-4 py-3 text-right">Total DO</th><th className="px-4 py-3 text-right">Total Tonase</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {topCheckers.map((r, i) => <tr key={i}><td className="px-4 py-3"><span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">{i + 1}</span></td><td className="px-4 py-3 font-medium">{r.checker}</td><td className="px-4 py-3 text-right text-slate-600">{r.count}</td><td className="px-4 py-3 text-right font-semibold">{formatTonnage(r.tonnage)}</td></tr>)}
          </tbody>
        </table></div>;
      default: return null;
    }
  };

  return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <label className="block text-sm font-medium">Data
        <Select value={summaryType || undefined} onValueChange={setSummaryType}>
          <SelectTrigger className="mt-1.5 w-full sm:w-[240px]">
            <SelectValue placeholder="Pilih Data" />
          </SelectTrigger>
          <SelectContent>
            {SUMMARY_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </label>
      <label className="block text-sm font-medium">Gudang<div className="mt-1.5"><WarehouseMultiSelect value={warehouse} onChange={setWarehouse} className="w-full sm:w-[180px]" /></div></label>
      <label className="block text-sm font-medium">Dari<input type="date" max={end} value={start} onChange={(e) => setStart(e.target.value)} className={`mt-1.5 block w-full ${inputClass} sm:w-auto`} /></label>
      <label className="block text-sm font-medium">Sampai<input type="date" min={start} max={today()} value={end} onChange={(e) => setEnd(e.target.value)} className={`mt-1.5 block w-full ${inputClass} sm:w-auto`} /></label>
      </div>
    <button onClick={() => { setStart(daysAgo(6)); setEnd(today()); }} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 w-full sm:w-auto">7 Hari Terakhir</button>
    </div>
    <div className="mt-4">{renderSummary()}</div>
  </div>;
}
import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from "recharts";
import { Truck, Maximize2, Download } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import html2canvas from "html2canvas";
import { base44 } from "@/api/base44Client";
import WarehouseMultiSelect from "./WarehouseMultiSelect";
import { today, formatTonnage } from "./shippingUtils";

const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

export default function TopShipmentsChart() {
  const [start, setStart] = useState(daysAgo(6));
  const [end, setEnd] = useState(today());
  const [chartWarehouse, setChartWarehouse] = useState([]);
  const [expanded, setExpanded] = useState(false);
  const chartRef = useRef(null);
  const dialogRef = useRef(null);
  const warehouseQuery = chartWarehouse.length === 0 ? {} : { warehouse: { $in: chartWarehouse } };
  const { data = [], isLoading } = useQuery({
    queryKey: ["shipments", "top", start, end, chartWarehouse],
    queryFn: () => base44.entities.Shipment.filter({ delivery_date: { $gte: start, $lte: end }, ...warehouseQuery }, "-tonnage", 500),
  });

  const top5 = useMemo(() => {
    const map = {};
    data.forEach((s) => { const k = s.outlet_name || "Tanpa Nama"; map[k] = (map[k] || 0) + Number(s.tonnage || 0); });
    return Object.entries(map).map(([name, tonnage]) => ({ name, tonnage })).sort((a, b) => b.tonnage - a.tonnage).slice(0, 5);
  }, [data]);

  const inputClass = "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";

  const capture = async (ref) => {
    if (!ref.current) return;
    const canvas = await html2canvas(ref.current, { backgroundColor: "#ffffff", scale: 2 });
    const link = document.createElement("a");
    link.download = `top5-tonase-${start}_sampai_${end}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const renderChart = (ref, height) => (
    <div ref={ref} className="bg-white p-2">
      {isLoading ? <div className="flex items-center justify-center" style={{ height }}><div className="h-7 w-7 animate-spin rounded-full border-4 border-indigo-100 border-t-indigo-600" /></div>
        : top5.length === 0 ? <div className="flex flex-col items-center justify-center text-slate-400" style={{ height }}><Truck className="mb-2 h-8 w-8" /><p className="text-sm">Tidak ada data pada rentang ini</p></div>
        : <div style={{ height }}><ResponsiveContainer width="100%" height="100%">
          <BarChart data={top5} margin={{ top: 24, right: 16, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={60} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v) => [formatTonnage(v), "Total Tonase"]} labelFormatter={(label) => `Outlet Tujuan: ${label}`} />
            <Bar dataKey="tonnage" radius={[6, 6, 0, 0]} fill="#6366f1">
              <LabelList dataKey="tonnage" position="top" formatter={(v) => formatTonnage(v)} style={{ fontSize: 11, fill: "#475569", fontWeight: 600 }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer></div>}
    </div>
  );

  const renderChartLandscape = (ref) => (
    <div ref={ref} className="bg-white p-2">
      {isLoading ? <div className="flex items-center justify-center" style={{ height: 420 }}><div className="h-7 w-7 animate-spin rounded-full border-4 border-indigo-100 border-t-indigo-600" /></div>
        : top5.length === 0 ? <div className="flex flex-col items-center justify-center text-slate-400" style={{ height: 420 }}><Truck className="mb-2 h-8 w-8" /><p className="text-sm">Tidak ada data pada rentang ini</p></div>
        : <div style={{ height: 420 }}><ResponsiveContainer width="100%" height="100%">
          <BarChart layout="vertical" data={top5} margin={{ top: 16, right: 48, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
            <XAxis type="number" tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={130} />
            <Tooltip formatter={(v) => [formatTonnage(v), "Total Tonase"]} labelFormatter={(label) => `Outlet Tujuan: ${label}`} />
            <Bar dataKey="tonnage" radius={[0, 6, 6, 0]} fill="#6366f1">
              <LabelList dataKey="tonnage" position="right" formatter={(v) => formatTonnage(v)} style={{ fontSize: 11, fill: "#475569", fontWeight: 600 }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer></div>}
    </div>
  );

  return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm font-medium">Gudang<div className="mt-1.5"><WarehouseMultiSelect value={chartWarehouse} onChange={setChartWarehouse} className="w-[180px]" /></div></label>
        <label className="text-sm font-medium">Dari<input type="date" max={end} value={start} onChange={(e) => setStart(e.target.value)} className={`mt-1.5 ${inputClass}`} /></label>
        <label className="text-sm font-medium">Sampai<input type="date" min={start} max={today()} value={end} onChange={(e) => setEnd(e.target.value)} className={`mt-1.5 ${inputClass}`} /></label>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={() => capture(chartRef)} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"><Download className="h-3.5 w-3.5" />Download</button>
        <button onClick={() => setExpanded(true)} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"><Maximize2 className="h-3.5 w-3.5" />Perbesar</button>
        <button onClick={() => { setStart(daysAgo(6)); setEnd(today()); }} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50">7 Hari Terakhir</button>
      </div>
    </div>

    <div className="mt-5">{renderChart(chartRef, 288)}</div>

    {top5.length > 0 && <ul className="mt-5 space-y-2">
      {top5.map((item, i) => (
        <li key={item.name} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2.5 text-sm">
          <span className="flex items-center gap-2.5"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">{i + 1}</span><span className="font-medium text-slate-700">{item.name}</span></span>
          <span className="font-semibold text-slate-900">Total Tonase: {formatTonnage(item.tonnage)}</span>
        </li>
      ))}
    </ul>}

    <Dialog open={expanded} onOpenChange={setExpanded}>
      <DialogContent className="max-w-5xl">
        <div className="flex items-center justify-between">
          <DialogTitle className="text-lg font-bold">Top 5 Tonase (Lanskap)</DialogTitle>
          <button onClick={() => capture(dialogRef)} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"><Download className="h-3.5 w-3.5" />Download</button>
        </div>
        {renderChartLandscape(dialogRef)}
      </DialogContent>
    </Dialog>
  </div>;
}
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { BarChart3, Download } from "lucide-react";
import * as XLSX from "xlsx";
import { base44 } from "@/api/base44Client";
import WarehouseMultiSelect from "@/components/shipping/WarehouseMultiSelect";
import { today } from "@/components/shipping/shippingUtils";

const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return fmt(d); };
const shortDate = (s) => { const [y, m, d] = (s || "").split("-"); return m && d ? `${d}/${m}` : s; };
const inputClass = "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";

export default function ReportTrenHarian({ dateFrom, dateTo, warehouses = [] }) {
  const [start, setStart] = useState(dateFrom || daysAgo(6));
  const [end, setEnd] = useState(dateTo || today());
  const [ws, setWs] = useState(warehouses);
  const isAll = !ws || ws.length === 0;
  const wq = isAll ? {} : { warehouse: { $in: ws } };
  const { data = [], isLoading } = useQuery({ queryKey: ["shipments", "trenHarian", start, end, ws], queryFn: () => base44.entities.Shipment.filter({ delivery_date: { $gte: start, $lte: end }, ...wq }, "-delivery_date", 1000) });

  const chartData = useMemo(() => {
    const map = {};
    const s = new Date(start + "T00:00:00"); const e = new Date(end + "T00:00:00");
    for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) { map[fmt(d)] = { date: fmt(d), count: 0, tonnage: 0 }; }
    for (const sh of data) { const d = sh.delivery_date; if (d && map[d]) { map[d].count += 1; map[d].tonnage += Number(sh.tonnage || 0); } }
    return Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
  }, [data, start, end]);

  const total = chartData.reduce((s, x) => s + x.count, 0);
  const totalTonnage = chartData.reduce((s, x) => s + x.tonnage, 0);

  const download = () => {
    const header = ["Tanggal", "Jumlah Pengiriman", "Total Tonase (kg)"];
    const data = chartData.map((r) => [r.date, r.count, Number(r.tonnage)]);
    const ws = XLSX.utils.aoa_to_sheet([["Tren Pengiriman Harian"], [], header, ...data]);
    ws["!cols"] = [{ wch: 14 }, { wch: 18 }, { wch: 18 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Tren Harian");
    XLSX.writeFile(wb, "tren-pengiriman-harian.xlsx");
  };

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm font-medium">Gudang<div className="mt-1.5"><WarehouseMultiSelect value={ws} onChange={setWs} className="w-[180px]" /></div></label>
          <label className="text-sm font-medium">Dari<input type="date" max={end} value={start} onChange={(e) => setStart(e.target.value)} className={`mt-1.5 ${inputClass}`} /></label>
          <label className="text-sm font-medium">Sampai<input type="date" min={start} value={end} onChange={(e) => setEnd(e.target.value)} className={`mt-1.5 ${inputClass}`} /></label>
          <button onClick={() => { setStart(daysAgo(6)); setEnd(today()); }} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50">7 Hari Terakhir</button>
        </div>
        <button onClick={download} disabled={!chartData.length} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"><Download className="h-4 w-4" />Download</button>
      </div>
      <p className="mb-3 text-sm text-slate-500">{total} pengiriman · Total Tonase {Number(totalTonnage).toLocaleString("id-ID")} kg</p>
      <div className="h-80 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        {isLoading ? <div className="flex h-full items-center justify-center"><div className="h-7 w-7 animate-spin rounded-full border-4 border-indigo-100 border-t-indigo-600" /></div>
          : chartData.length === 0 ? <div className="flex h-full flex-col items-center justify-center text-slate-400"><BarChart3 className="mb-2 h-8 w-8" /><p className="text-sm">Tidak ada data pada rentang ini</p></div>
          : <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 16, right: 16, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={shortDate} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip formatter={(v, name) => name === "Jumlah Pengiriman" ? [`${v} pengiriman`, "Jumlah"] : [`${Number(v).toLocaleString("id-ID")} kg`, "Tonase"]} labelFormatter={(l) => `Tanggal: ${l}`} />
                <Bar dataKey="count" name="Jumlah Pengiriman" radius={[6, 6, 0, 0]} fill="#6366f1" />
              </BarChart>
            </ResponsiveContainer>}
      </div>
    </div>
  );
}
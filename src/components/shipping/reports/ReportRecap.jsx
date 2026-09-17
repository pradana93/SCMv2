import { useMemo } from "react";
import { Download } from "lucide-react";
import * as XLSX from "xlsx";
import { formatTonnage } from "../shippingUtils";
import { useOutletEtaMap, computeEstimatedArrival } from "../etaUtils";

const pad = (n) => String(n).padStart(2, "0");
const weekStart = (dateStr) => { if (!dateStr) return ""; const d = new Date(dateStr + "T00:00:00"); const day = (d.getDay() + 6) % 7; d.setDate(d.getDate() - day); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const MONTH_NAMES = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const monthLabel = (ym) => { const [y, m] = ym.split("-"); return `${MONTH_NAMES[Number(m) - 1] || ym} ${y}`; };

export default function ReportRecap({ shipments, mode }) {
  const etaMap = useOutletEtaMap();
  const rows = useMemo(() => {
    const map = new Map();
    for (const s of (shipments || [])) {
      const key = mode === "weekly" ? weekStart(s.delivery_date) : (s.delivery_date || "").slice(0, 7);
      if (!key) continue;
      const e = map.get(key) || { period: key, count: 0, tonnage: 0, delivered: 0, onTime: 0, late: 0, withActual: 0 };
      e.count += 1;
      e.tonnage += Number(s.tonnage || 0);
      if (s.status === "sudah_dikirim") {
        e.delivered += 1;
        if (s.actual_arrival_date) {
          const est = computeEstimatedArrival(s, etaMap);
          e.withActual += 1;
          if (est && s.actual_arrival_date <= est) e.onTime += 1;
          else if (est) e.late += 1;
        }
      }
      map.set(key, e);
    }
    return [...map.values()].sort((a, b) => a.period.localeCompare(b.period));
  }, [shipments, mode, etaMap]);

  const periodLabel = (p) => mode === "weekly" ? `Minggu ${p}` : monthLabel(p);
  const totalTonase = rows.reduce((s, r) => s + r.tonnage, 0);
  const totalOnTime = rows.reduce((s, r) => s + r.onTime, 0);
  const totalWithActual = rows.reduce((s, r) => s + r.withActual, 0);
  const overallOtd = totalWithActual > 0 ? Math.round((totalOnTime / totalWithActual) * 1000) / 10 : 0;

  const download = () => {
    const title = mode === "weekly" ? "Rekap Pengiriman Mingguan" : "Rekap Pengiriman Bulanan";
    const header = ["Periode", "Total Pengiriman", "Total Tonase (kg)", "Sudah Dikirim", "Tepat Waktu", "Terlambat", "On Time Delivery (%)"];
    const data = rows.map((r) => [periodLabel(r.period), r.count, Number(r.tonnage), r.delivered, r.onTime, r.late, r.withActual > 0 ? Math.round((r.onTime / r.withActual) * 1000) / 10 : 0]);
    const summary = [[`Total Tonase: ${formatTonnage(totalTonase)}`], [`On Time Delivery Keseluruhan: ${overallOtd}%`], [`Dibuat: ${new Date().toLocaleString("id-ID")}`], []];
    const ws = XLSX.utils.aoa_to_sheet([[title], [], ...summary, header, ...data]);
    ws["!cols"] = [{ wch: 20 }, { wch: 16 }, { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 22 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, mode === "weekly" ? "Rekap Mingguan" : "Rekap Bulanan");
    XLSX.writeFile(wb, mode === "weekly" ? "rekap-pengiriman-mingguan.xlsx" : "rekap-pengiriman-bulanan.xlsx");
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-slate-500">{rows.length} periode · Total Tonase {formatTonnage(totalTonase)} · OTD {overallOtd}%</p>
        <button onClick={download} disabled={!rows.length} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"><Download className="h-4 w-4" />Download</button>
      </div>
      {rows.length === 0 ? <p className="text-sm text-slate-400">Tidak ada data sesuai filter ini.</p> :
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Periode</th>
                <th className="px-4 py-3 text-right">Total Pengiriman</th>
                <th className="px-4 py-3 text-right">Total Tonase</th>
                <th className="px-4 py-3 text-right">Sudah Dikirim</th>
                <th className="px-4 py-3 text-right">Tepat Waktu</th>
                <th className="px-4 py-3 text-right">Terlambat</th>
                <th className="px-4 py-3 text-right">OTD (%)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.period} className="hover:bg-slate-50/60">
                  <td className="px-4 py-3 font-medium text-slate-700">{periodLabel(r.period)}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{r.count}</td>
                  <td className="px-4 py-3 text-right font-semibold">{formatTonnage(r.tonnage)}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{r.delivered}</td>
                  <td className="px-4 py-3 text-right text-emerald-600">{r.onTime}</td>
                  <td className="px-4 py-3 text-right text-rose-600">{r.late}</td>
                  <td className="px-4 py-3 text-right font-semibold text-indigo-700">{r.withActual > 0 ? `${Math.round((r.onTime / r.withActual) * 1000) / 10}%` : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>}
    </div>
  );
}
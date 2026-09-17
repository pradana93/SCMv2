import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import * as XLSX from "xlsx";
import { formatTonnage } from "../shippingUtils";
import CheckerDoDialog from "./CheckerDoDialog";

export default function ReportChecker({ shipments }) {
  const [detail, setDetail] = useState(null);
  const rows = useMemo(() => {
    const map = new Map();
    for (const s of (shipments || []).filter((s) => s.status === "sudah_dikirim")) {
      const key = (s.checker_name || "").trim() || "(tanpa checker)";
      const e = map.get(key) || { checker: key, tonnage: 0, count: 0, complaints: 0, warehouses: new Set() };
      e.tonnage += Number(s.tonnage || 0);
      e.count += 1;
      if (s.accuracy === "ada_komplain") e.complaints += 1;
      if (s.warehouse) e.warehouses.add(s.warehouse);
      map.set(key, e);
    }
    const arr = [...map.values()];
    const maxT = Math.max(1, ...arr.map((r) => r.tonnage));
    const maxC = Math.max(1, ...arr.map((r) => r.count));
    const maxK = Math.max(1, ...arr.map((r) => r.complaints));
    for (const r of arr) {
      const nT = r.tonnage / maxT;
      const nD = r.count / maxC;
      const nK = r.complaints / maxK;
      r.score = Math.round((0.5 * nT + 0.2 * nD - 0.3 * nK) * 1000) / 1000;
    }
    for (const r of arr) r.warehouse = [...r.warehouses].sort((a, b) => a.localeCompare(b, "id")).join(", ") || "-";
    arr.sort((a, b) => b.score - a.score);
    return arr;
  }, [shipments]);

  const download = () => {
    const header = ["Peringkat", "Checker", "Gudang Asal", "Total Tonase (kg)", "Total DO", "Komplain", "Skor Penilaian", "Rata-rata Tonase per DO (kg)"];
    const data = rows.map((r, i) => [i + 1, r.checker, r.warehouse, Number(r.tonnage), r.count, r.complaints, r.score, r.count > 0 ? Math.round((r.tonnage / r.count) * 100) / 100 : 0]);
    const ws = XLSX.utils.aoa_to_sheet([header, ...data]);
    ws["!cols"] = [{ wch: 10 }, { wch: 24 }, { wch: 24 }, { wch: 16 }, { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 24 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Checker");
    XLSX.writeFile(wb, "report-checker.xlsx", { bookType: "xlsx" });
  };

  return <div>
    <div className="mb-3 flex items-center justify-between">
      <p className="text-sm text-slate-500">{rows.length} checker · diurutkan berdasarkan skor penilaian (Tonase 50%, DO 20%, Komplain 30%) · klik Total DO untuk lihat rincian</p>
      <button onClick={download} disabled={!rows.length} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"><Download className="h-4 w-4" />Download</button>
    </div>
    {rows.length === 0 ? <p className="text-sm text-slate-400">Tidak ada data sesuai filter ini.</p> :
      <div className="overflow-auto max-h-[70vh] rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500 shadow-sm">
            <tr>
              <th className="px-4 py-3">Peringkat</th>
              <th className="px-4 py-3">Checker</th>
              <th className="px-4 py-3">Gudang Asal</th>
              <th className="px-4 py-3 text-right">Total Tonase</th>
              <th className="px-4 py-3 text-right">Total DO</th>
              <th className="px-4 py-3 text-right">Komplain</th>
              <th className="px-4 py-3 text-right">Skor Penilaian</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r, i) => (
              <tr key={i}>
                <td className="px-4 py-3"><span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">{i + 1}</span></td>
                <td className="px-4 py-3 font-medium">{r.checker}</td>
                <td className="px-4 py-3 text-slate-600 max-w-[200px] truncate" title={r.warehouse}>{r.warehouse}</td>
                <td className="px-4 py-3 text-right font-semibold">{formatTonnage(r.tonnage)}</td>
                <td className="px-4 py-3 text-right"><button onClick={() => setDetail(r.checker)} className="font-semibold text-indigo-600 transition hover:underline">{r.count}</button></td>
                <td className="px-4 py-3 text-right"><span className={r.complaints > 0 ? "font-semibold text-rose-600" : "text-slate-500"}>{r.complaints}</span></td>
                <td className="px-4 py-3 text-right font-bold text-indigo-700">{r.score.toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>}
    <CheckerDoDialog checker={detail} shipments={shipments} onClose={() => setDetail(null)} />
  </div>;
}
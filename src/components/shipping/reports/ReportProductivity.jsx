import { useMemo } from "react";
import { Download } from "lucide-react";
import * as XLSX from "xlsx";
import { formatTonnage } from "../shippingUtils";

const fmtInt = (v) => Number(v || 0).toLocaleString("id-ID");
const fmtDec = (v) => (Number(v || 0)).toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export default function ReportProductivity({ shipments }) {
  const rows = useMemo(() => {
    const map = {};
    for (const s of shipments) {
      const d = s.delivery_date || "";
      if (!d) continue;
      if (!map[d]) map[d] = { date: d, doCount: 0, tonnage: 0, pickCrew: 0, packCrew: 0, loadCrew: 0 };
      const r = map[d];
      r.doCount += 1;
      r.tonnage += Number(s.tonnage || 0);
      r.pickCrew += Number(s.picking_crew_count || 0);
      r.packCrew += Number(s.packing_crew_count || 0);
      r.loadCrew += Number(s.loading_crew_count || 0);
    }
    return Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
  }, [shipments]);

  const totals = useMemo(() => rows.reduce((acc, r) => {
    acc.doCount += r.doCount;
    acc.tonnage += r.tonnage;
    acc.pickCrew += r.pickCrew;
    acc.packCrew += r.packCrew;
    acc.loadCrew += r.loadCrew;
    return acc;
  }, { doCount: 0, tonnage: 0, pickCrew: 0, packCrew: 0, loadCrew: 0 }), [rows]);

  const download = () => {
    const header = ["Date", "Total DO", "Total Tonase", "Avg Tonase / Crew Picking", "Avg Tonase / Crew Packing", "Avg Tonase / Crew Loading"];
    const data = rows.map((r) => [
      r.date, r.doCount, r.tonnage,
      r.pickCrew > 0 ? Math.round((r.tonnage / r.pickCrew) * 100) / 100 : "",
      r.packCrew > 0 ? Math.round((r.tonnage / r.packCrew) * 100) / 100 : "",
      r.loadCrew > 0 ? Math.round((r.tonnage / r.loadCrew) * 100) / 100 : "",
    ]);
    const totalRow = [
      "Total", totals.doCount, totals.tonnage,
      totals.pickCrew > 0 ? Math.round((totals.tonnage / totals.pickCrew) * 100) / 100 : "",
      totals.packCrew > 0 ? Math.round((totals.tonnage / totals.packCrew) * 100) / 100 : "",
      totals.loadCrew > 0 ? Math.round((totals.tonnage / totals.loadCrew) * 100) / 100 : "",
    ];
    const ws = XLSX.utils.aoa_to_sheet([header, ...data, totalRow]);
    ws["!cols"] = header.map(() => ({ wch: 18 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Productivity Review");
    XLSX.writeFile(wb, "laporan-productivity.xlsx", { bookType: "xlsx" });
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-slate-500">{rows.length} hari · {totals.doCount} DO · {formatTonnage(totals.tonnage)}</p>
        <button onClick={download} disabled={!rows.length} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"><Download className="h-4 w-4" />Download Excel</button>
      </div>
      {rows.length === 0 ? <p className="text-sm text-slate-400">Tidak ada data sesuai filter ini.</p> :
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="overflow-auto max-h-[70vh]"><table className="w-full text-left text-sm">
          <thead className="sticky top-0 z-10 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 shadow-sm"><tr>
            <th className="px-4 py-3">Date</th><th className="px-4 py-3 text-right">Total DO</th><th className="px-4 py-3 text-right">Total Tonase</th><th className="px-4 py-3 text-right">Avg Tonase / Crew Picking</th><th className="px-4 py-3 text-right">Avg Tonase / Crew Packing</th><th className="px-4 py-3 text-right">Avg Tonase / Crew Loading</th>
          </tr></thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.date} className="align-top">
                <td className="px-4 py-3 text-slate-600">{r.date}</td>
                <td className="px-4 py-3 text-right text-slate-600">{fmtInt(r.doCount)}</td>
                <td className="px-4 py-3 text-right text-slate-600">{fmtInt(r.tonnage)}</td>
                <td className="px-4 py-3 text-right text-slate-600">{r.pickCrew > 0 ? fmtDec(r.tonnage / r.pickCrew) : "-"}</td>
                <td className="px-4 py-3 text-right text-slate-600">{r.packCrew > 0 ? fmtDec(r.tonnage / r.packCrew) : "-"}</td>
                <td className="px-4 py-3 text-right text-slate-600">{r.loadCrew > 0 ? fmtDec(r.tonnage / r.loadCrew) : "-"}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-slate-50 font-semibold">
            <tr>
              <td className="px-4 py-3 text-slate-800">Total</td>
              <td className="px-4 py-3 text-right text-slate-800">{fmtInt(totals.doCount)}</td>
              <td className="px-4 py-3 text-right text-slate-800">{fmtInt(totals.tonnage)}</td>
              <td className="px-4 py-3 text-right text-slate-800">{totals.pickCrew > 0 ? fmtDec(totals.tonnage / totals.pickCrew) : "-"}</td>
              <td className="px-4 py-3 text-right text-slate-800">{totals.packCrew > 0 ? fmtDec(totals.tonnage / totals.packCrew) : "-"}</td>
              <td className="px-4 py-3 text-right text-slate-800">{totals.loadCrew > 0 ? fmtDec(totals.tonnage / totals.loadCrew) : "-"}</td>
            </tr>
          </tfoot>
        </table></div></div>}
      </div>
  );
}
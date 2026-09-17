import { useMemo } from "react";
import { Download } from "lucide-react";
import * as XLSX from "xlsx";
import { formatTonnage } from "../shippingUtils";

export default function ReportTonase({ shipments, dateFrom, dateTo }) {
  const rows = useMemo(() => {
    const map = new Map();
    for (const s of (shipments || [])) {
      const outlet = (s.outlet_name || "(Tanpa Outlet)").trim();
      const cur = map.get(outlet) || { outlet, tonnage: 0, doCount: 0, warehouses: new Set() };
      cur.tonnage += Number(s.tonnage || 0);
      cur.doCount += 1;
      if (s.warehouse) cur.warehouses.add(s.warehouse);
      map.set(outlet, cur);
    }
    return [...map.values()]
      .map((r) => ({ ...r, warehouse: [...r.warehouses].sort((a, b) => a.localeCompare(b, "id")).join(", ") || "-" }))
      .sort((a, b) => b.tonnage - a.tonnage);
  }, [shipments]);

  const totalTonnage = rows.reduce((s, r) => s + r.tonnage, 0);
  const totalDo = rows.reduce((s, r) => s + r.doCount, 0);

  const download = () => {
    const titleRows = [
      ["Laporan Total Tonase Pengiriman"],
      [`Periode: ${dateFrom || "-"} s/d ${dateTo || "-"}`],
      [`Total: ${rows.length} outlet · ${totalDo} DO · ${formatTonnage(totalTonnage)}`],
      [],
    ];
    const header = ["No", "Outlet Tujuan", "Jumlah DO", "Total Tonase (kg)", "Gudang Asal"];
    const data = rows.map((r, i) => [i + 1, r.outlet, r.doCount, Number(r.tonnage), r.warehouse]);
    const ws = XLSX.utils.aoa_to_sheet([...titleRows, header, ...data]);
    ws["!cols"] = [{ wch: 6 }, { wch: 28 }, { wch: 12 }, { wch: 18 }, { wch: 30 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Total Tonase");
    XLSX.writeFile(wb, "report-total-tonase.xlsx", { bookType: "xlsx" });
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-slate-500">{rows.length} outlet · {totalDo} DO · {formatTonnage(totalTonnage)}</p>
        <button onClick={download} disabled={!rows.length} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"><Download className="h-4 w-4" />Download</button>
      </div>
      {rows.length === 0 ? <p className="text-sm text-slate-400">Tidak ada data sesuai filter ini.</p> :
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-auto max-h-[70vh]">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 z-10 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 shadow-sm">
                <tr>
                  <th className="px-4 py-3">No</th>
                  <th className="px-4 py-3">Outlet Tujuan</th>
                  <th className="px-4 py-3 text-right">Jumlah DO</th>
                  <th className="px-4 py-3 text-right">Total Tonase</th>
                  <th className="px-4 py-3">Gudang Asal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r, i) => (
                  <tr key={i} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3 text-slate-500">{i + 1}</td>
                    <td className="px-4 py-3 font-medium text-slate-700">{r.outlet}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{r.doCount}</td>
                    <td className="px-4 py-3 text-right font-semibold text-indigo-700">{formatTonnage(r.tonnage)}</td>
                    <td className="px-4 py-3 text-slate-500">{r.warehouse}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="sticky bottom-0 bg-slate-50 font-semibold">
                <tr>
                  <td className="px-4 py-3 text-slate-800" colSpan={2}>Total</td>
                  <td className="px-4 py-3 text-right text-slate-800">{totalDo}</td>
                  <td className="px-4 py-3 text-right text-slate-800">{formatTonnage(totalTonnage)}</td>
                  <td className="px-4 py-3"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>}
    </div>
  );
}
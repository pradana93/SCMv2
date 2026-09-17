import { Download } from "lucide-react";
import * as XLSX from "xlsx";
import { useOutletEtaMap, computeEstimatedArrival } from "../etaUtils";
import { formatTonnage, statusMeta } from "../shippingUtils";

const daysDiff = (a, b) => {
  if (!a || !b) return null;
  const d1 = new Date(`${a}T00:00:00`);
  const d2 = new Date(`${b}T00:00:00`);
  return Math.round((d2 - d1) / 86400000);
};

export default function ReportOtd({ shipments }) {
  const etaMap = useOutletEtaMap();
  const list = (shipments || [])
    .filter((s) => s.status === "sudah_dikirim" && s.actual_arrival_date)
    .map((s) => {
      const est = computeEstimatedArrival(s, etaMap);
      const late = est ? daysDiff(est, s.actual_arrival_date) : null;
      return { s, est, late, note: late == null ? "-" : late <= 0 ? "Tepat Waktu" : `Terlambat ${late} hari` };
    })
    .sort((a, b) => (a.s.delivery_date || "").localeCompare(b.s.delivery_date || ""));

  const download = () => {
    const header = ["Tanggal", "DO Number", "Gudang Asal", "Outlet Tujuan", "Armada", "Tonase (kg)", "Estimasi Tiba", "Aktual Tiba", "Keterangan Terlambat"];
    const rows = list.map(({ s, est, note }) => [s.delivery_date, s.do_number || "-", s.warehouse, s.outlet_name, s.fleet || "-", Number(s.tonnage || 0), est || "-", s.actual_arrival_date, note]);
    const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
    ws["!cols"] = header.map(() => ({ wch: 16 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Detail On Time Delivery");
    XLSX.writeFile(wb, "detail-on-time-delivery.xlsx", { bookType: "xlsx" });
  };

  return <div>
    <div className="mb-3 flex items-center justify-between">
      <p className="text-sm text-slate-500">{list.length} pengiriman dengan aktual tiba</p>
      <button onClick={download} disabled={!list.length} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"><Download className="h-4 w-4" />Download</button>
    </div>
    {list.length === 0 ? <p className="text-sm text-slate-400">Tidak ada data aktual tiba pada rentang ini.</p> :
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="overflow-auto max-h-[70vh]"><table className="w-full text-left text-sm">
        <thead className="sticky top-0 z-10 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 shadow-sm"><tr>
          <th className="px-4 py-3">Tanggal</th><th className="px-4 py-3">DO Number</th><th className="px-4 py-3">Gudang Asal</th><th className="px-4 py-3">Outlet Tujuan</th><th className="px-4 py-3">Armada</th><th className="px-4 py-3">Tonase</th><th className="px-4 py-3">Estimasi Tiba</th><th className="px-4 py-3">Aktual Tiba</th><th className="px-4 py-3">Keterangan Terlambat</th>
        </tr></thead>
        <tbody className="divide-y divide-slate-100">
          {list.map(({ s, est, late, note }) => (
            <tr key={s.id} className="align-top">
              <td className="px-4 py-3 text-slate-600">{s.delivery_date}</td>
              <td className="px-4 py-3 text-slate-600">{s.do_number || "-"}</td>
              <td className="px-4 py-3 text-slate-600">{s.warehouse}</td>
              <td className="px-4 py-3 font-semibold">{s.outlet_name}</td>
              <td className="px-4 py-3 text-slate-600">{s.fleet || "-"}</td>
              <td className="px-4 py-3 text-slate-600">{formatTonnage(s.tonnage)}</td>
              <td className="px-4 py-3 text-slate-600">{est || "-"}</td>
              <td className="px-4 py-3 text-slate-600">{s.actual_arrival_date}</td>
              <td className="px-4 py-3"><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${late > 0 ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"}`}>{note}</span></td>
            </tr>
          ))}
        </tbody>
      </table></div></div>}
  </div>;
}
import { useState } from "react";
import { Download } from "lucide-react";
import * as XLSX from "xlsx";
import { formatTonnage, statusMeta, menungguStartTime } from "../shippingUtils";
import ReportDoPdfDialog from "./ReportDoPdfDialog";
import { useOutletEtaMap, computeEstimatedArrival } from "../etaUtils";

const pad2 = (n) => String(n).padStart(2, "0");
const durasiMs = (a, b) => { if (!a || !b) return null; const t1 = new Date(a).getTime(); const t2 = new Date(b).getTime(); if (isNaN(t1) || isNaN(t2) || t2 < t1) return null; return t2 - t1; };
const fmtHHMMSS = (ms) => { if (ms == null) return "-"; const h = Math.floor(ms / 3600000); const m = Math.floor((ms % 3600000) / 60000); const s = Math.floor((ms % 60000) / 1000); return `${pad2(h)}:${pad2(m)}:${pad2(s)}`; };
const totalCrew = (s) => { const sum = Number(s.picking_crew_count || 0) + Number(s.packing_crew_count || 0) + Number(s.loading_crew_count || 0); return sum > 0 ? sum : Number(s.crew_count || 0); };
const prod = (ton, crew) => crew > 0 ? Math.round((ton / crew) * 100) / 100 : null;

export default function ReportByStatus({ shipments, status }) {
  const [selected, setSelected] = useState(null);
  const filtered = status === "all" ? shipments : shipments.filter((s) => s.status === status);
  const isDelivered = status === "sudah_dikirim";
  const etaMap = useOutletEtaMap();

  const download = () => {
    const baseHeader = ["Tanggal", "Gudang Asal", "Tujuan", "DO No", "Status", "Tonase (kg)", "Armada", "Menunggu Antrian (HH:MM:SS)", "Picking (HH:MM:SS)", "Packing (HH:MM:SS)", "Loading (HH:MM:SS)", "Total Durasi (HH:MM:SS)", "PIC Picking", "Checker", "Tonase per Crew (kg)"];
    const extraHeader = ["Crew Picking", "Crew Packing", "Crew Loading", "Jumlah Crew", "Produktivitas Picking (kg/crew)", "Produktivitas Packing (kg/crew)", "Produktivitas Loading (kg/crew)"];
    const etaHeader = ["Estimasi Tiba", "Aktual Tiba", "On Time"];
    const header = isDelivered ? [...baseHeader, ...extraHeader, ...etaHeader] : baseHeader;
    const rows = filtered.map((s) => {
      const tc = totalCrew(s);
      const ton = Number(s.tonnage || 0);
      const base = [
        s.delivery_date, s.warehouse, s.outlet_name, s.do_number || "-",
        (statusMeta[s.status] || statusMeta.menunggu_antrian).label,
        ton,
        s.fleet || "-",
        fmtHHMMSS(durasiMs(menungguStartTime(s.delivery_date), s.timestamp_proses_picking)),
        fmtHHMMSS(durasiMs(s.timestamp_proses_picking, s.timestamp_proses_picking_end)),
        fmtHHMMSS(durasiMs(s.timestamp_proses_packing, s.timestamp_proses_packing_end)),
        fmtHHMMSS(durasiMs(s.timestamp_proses_loading, s.timestamp_proses_loading_end)),
        fmtHHMMSS(durasiMs(menungguStartTime(s.delivery_date), s.timestamp_sudah_dikirim)),
        s.picking_pic || "-",
        s.checker_name || "-",
        tc > 0 ? Math.round((ton / tc) * 100) / 100 : "",
      ];
      if (isDelivered) {
        const cp = Number(s.picking_crew_count || 0), pk = Number(s.packing_crew_count || 0), cl = Number(s.loading_crew_count || 0);
        base.push(cp, pk, cl, tc, prod(ton, cp) ?? "", prod(ton, pk) ?? "", prod(ton, cl) ?? "");
        const est = computeEstimatedArrival(s, etaMap);
        const act = s.actual_arrival_date || "";
        base.push(est || "-", act || "-", est && act ? (act <= est ? "Tepat Waktu" : "Terlambat") : "-");
      }
      return base;
    });
    const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
    ws["!cols"] = header.map(() => ({ wch: 16 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Daftar Pengiriman");
    XLSX.writeFile(wb, "daftar-pengiriman.xlsx", { bookType: "xlsx" });
  };

  return <div>
    <div className="mb-3 flex items-center justify-between">
      <p className="text-sm text-slate-500">{filtered.length} pengiriman · klik baris untuk lihat dokumen DO</p>
      <button onClick={download} disabled={!filtered.length} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"><Download className="h-4 w-4" />Download</button>
    </div>
    {filtered.length === 0 ? <p className="text-sm text-slate-400">Tidak ada data sesuai filter ini.</p> :
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="overflow-auto max-h-[70vh]"><table className="w-full text-left text-sm">
        <thead className="sticky top-0 z-10 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 shadow-sm"><tr>
          <th className="px-4 py-3">Tanggal</th><th className="px-4 py-3">Gudang Asal</th><th className="px-4 py-3">Tujuan</th><th className="px-4 py-3">DO No</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Tonase</th><th className="px-4 py-3">Armada</th><th className="px-4 py-3">Menunggu Antrian</th><th className="px-4 py-3">Picking</th><th className="px-4 py-3">Packing</th><th className="px-4 py-3">Loading</th><th className="px-4 py-3">Total Durasi</th><th className="px-4 py-3">PIC Picking</th><th className="px-4 py-3">Checker</th><th className="px-4 py-3">Tonase per Crew</th>
          {isDelivered && <><th className="px-4 py-3">Crew Picking</th><th className="px-4 py-3">Crew Packing</th><th className="px-4 py-3">Crew Loading</th><th className="px-4 py-3">Jumlah Crew</th><th className="px-4 py-3">Produktivitas Picking</th><th className="px-4 py-3">Produktivitas Packing</th><th className="px-4 py-3">Produktivitas Loading</th><th className="px-4 py-3">Estimasi Tiba</th><th className="px-4 py-3">Aktual Tiba</th><th className="px-4 py-3">On Time</th></>}
        </tr></thead>
        <tbody className="divide-y divide-slate-100">
          {filtered.map((s) => {
            const meta = statusMeta[s.status] || statusMeta.menunggu_antrian;
            const tc = totalCrew(s);
            const ton = Number(s.tonnage || 0);
            const cp = Number(s.picking_crew_count || 0), pk = Number(s.packing_crew_count || 0), cl = Number(s.loading_crew_count || 0);
            const estArrival = computeEstimatedArrival(s, etaMap);
            const actArrival = s.actual_arrival_date;
            return <tr key={s.id} onClick={() => setSelected(s)} className="cursor-pointer align-top transition hover:bg-indigo-50/60">
              <td className="px-4 py-3 text-slate-600">{s.delivery_date}</td>
              <td className="px-4 py-3 text-slate-600">{s.warehouse}</td>
              <td className="px-4 py-3 font-semibold">{s.outlet_name}</td>
              <td className="px-4 py-3 text-slate-600">{s.do_number || "-"}</td>
              <td className="px-4 py-3"><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${meta.className}`}>{meta.label}</span></td>
              <td className="px-4 py-3 text-slate-600">{formatTonnage(s.tonnage)}</td>
              <td className="px-4 py-3 text-slate-600">{s.fleet || "-"}</td>
              <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{fmtHHMMSS(durasiMs(menungguStartTime(s.delivery_date), s.timestamp_proses_picking))}</td>
              <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{fmtHHMMSS(durasiMs(s.timestamp_proses_picking, s.timestamp_proses_picking_end))}</td>
              <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{fmtHHMMSS(durasiMs(s.timestamp_proses_packing, s.timestamp_proses_packing_end))}</td>
              <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{fmtHHMMSS(durasiMs(s.timestamp_proses_loading, s.timestamp_proses_loading_end))}</td>
              <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{fmtHHMMSS(durasiMs(menungguStartTime(s.delivery_date), s.timestamp_sudah_dikirim))}</td>
              <td className="px-4 py-3 text-slate-600">{s.picking_pic || "-"}</td>
              <td className="px-4 py-3 text-slate-600">{s.checker_name || "-"}</td>
              <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{tc > 0 ? formatTonnage(Math.round((ton / tc) * 100) / 100) : "-"}</td>
              {isDelivered && <>
                <td className="px-4 py-3 text-slate-600">{cp || "-"}</td>
                <td className="px-4 py-3 text-slate-600">{pk || "-"}</td>
                <td className="px-4 py-3 text-slate-600">{cl || "-"}</td>
                <td className="px-4 py-3 text-slate-600">{tc || "-"}</td>
                <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{prod(ton, cp) != null ? formatTonnage(prod(ton, cp)) : "-"}</td>
                <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{prod(ton, pk) != null ? formatTonnage(prod(ton, pk)) : "-"}</td>
                <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{prod(ton, cl) != null ? formatTonnage(prod(ton, cl)) : "-"}</td>
                <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{estArrival || "-"}</td>
                <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{actArrival || "-"}</td>
                <td className="px-4 py-3 text-slate-600">{estArrival && actArrival ? (actArrival <= estArrival ? "Tepat Waktu" : "Terlambat") : "-"}</td>
              </>}
            </tr>;
          })}
        </tbody>
      </table></div></div>}
    <ReportDoPdfDialog shipment={selected} onClose={() => setSelected(null)} />
  </div>;
}
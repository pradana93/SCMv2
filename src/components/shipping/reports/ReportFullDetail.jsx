import { useState } from "react";
import { Download } from "lucide-react";
import * as XLSX from "xlsx";
import { formatTonnage, formatTimestamp, statusMeta, accuracyMeta } from "../shippingUtils";
import ReportDoPdfDialog from "./ReportDoPdfDialog";

const COMPLAINT_TYPE_LABELS = { kurang_kirim: "Kurang Kirim", lebih_kirim: "Lebih Kirim", rusak_waste: "Rusak/Waste", salah_input: "Salah Input", lainnya: "Lainnya" };
const COMPLAINT_CATEGORY_LABELS = { human_error: "Human Error", barang_waste: "Barang Waste", lainnya: "Lainnya" };
const DOC_TYPE_LABELS = { delivery_order: "Delivery Order", item_transfer: "Item Transfer" };
const arrToStr = (a, map) => Array.isArray(a) ? (a.length ? a.map((v) => map[v] || v).join(", ") : "-") : a ? (map[a] || a) : "-";
const statusTonase = (v) => v === "sesuai" ? "Sesuai" : v === "tidak_sesuai" ? "Tidak Sesuai" : "-";
const procDuration = (start, end) => {
  if (!start || !end) return "-";
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (isNaN(s) || isNaN(e) || e < s) return "-";
  const totalMin = Math.floor((e - s) / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};
const perCrew = (total, crew) => (crew && Number(crew) > 0) ? (Number(total || 0) / Number(crew)).toFixed(1) : "-";

const COLUMNS = [
  { key: "delivery_date", label: "Tanggal Pengiriman", value: (s) => s.delivery_date || "-" },
  { key: "document_type", label: "Tipe Dokumen", value: (s) => DOC_TYPE_LABELS[s.document_type] || "Delivery Order" },
  { key: "do_number", label: "DO Number", value: (s) => s.do_number || "-" },
  { key: "warehouse", label: "Gudang Asal", value: (s) => s.warehouse || "-" },
  { key: "outlet_name", label: "Outlet Tujuan", value: (s) => s.outlet_name || "-" },
  { key: "fleet", label: "Armada", value: (s) => s.fleet || "-" },
  { key: "license_plate", label: "Plat Nomor", value: (s) => s.license_plate || "-" },
  { key: "tonnage", label: "Tonase", value: (s) => formatTonnage(s.tonnage) },
  { key: "ro_tonnage", label: "Tonase RO", value: (s) => formatTonnage(s.ro_tonnage) },
  { key: "status", label: "Status", value: (s) => (statusMeta[s.status] || statusMeta.menunggu_antrian).label },
  { key: "picking_pic", label: "PIC Picking", value: (s) => s.picking_pic || "-" },
  { key: "picking_do_count", label: "Jml DO (RO)", value: (s) => (s.picking_do_count ?? "-") },
  { key: "picking_crew_count", label: "Crew Picking", value: (s) => (s.picking_crew_count ?? "-") },
  { key: "ro_tonnage_per_picking_crew", label: "Tonase RO/Crew Picking", value: (s) => perCrew(s.ro_tonnage, s.picking_crew_count) },
  { key: "picking_notes", label: "Catatan Picking", value: (s) => s.picking_notes || "-" },
  { key: "ro_received_by", label: "RO Diterima Oleh", value: (s) => s.ro_received_by || "-" },
  { key: "timestamp_proses_picking", label: "Mulai Picking", value: (s) => formatTimestamp(s.timestamp_proses_picking) },
  { key: "timestamp_proses_picking_end", label: "Selesai Picking", value: (s) => formatTimestamp(s.timestamp_proses_picking_end) },
  { key: "durasi_picking", label: "Durasi Picking", value: (s) => procDuration(s.timestamp_proses_picking, s.timestamp_proses_picking_end) },
  { key: "proof_picking_url", label: "Bukti Picking", value: (s) => s.proof_picking_url ? "Ada" : "-", isUrl: true },
  { key: "packing_checker_name", label: "Checker Packing", value: (s) => s.packing_checker_name || "-" },
  { key: "packing_crew_count", label: "Crew Packing", value: (s) => (s.packing_crew_count ?? "-") },
  { key: "koli_per_packing_crew", label: "Koli/Crew Packing", value: (s) => perCrew(s.packing_total_koli, s.packing_crew_count) },
  { key: "tonnage_per_packing_crew", label: "Tonase DO/Crew Packing", value: (s) => perCrew(s.tonnage, s.packing_crew_count) },
  { key: "packing_total_koli", label: "Total Koli", value: (s) => (s.packing_total_koli ?? "-") },
  { key: "packing_tonnage_status", label: "Status Tonase", value: (s) => statusTonase(s.packing_tonnage_status) },
  { key: "checker_name", label: "Checker", value: (s) => s.checker_name || "-" },
  { key: "timestamp_proses_packing", label: "Mulai Packing", value: (s) => formatTimestamp(s.timestamp_proses_packing) },
  { key: "timestamp_proses_packing_end", label: "Selesai Packing", value: (s) => formatTimestamp(s.timestamp_proses_packing_end) },
  { key: "durasi_packing", label: "Durasi Packing", value: (s) => procDuration(s.timestamp_proses_packing, s.timestamp_proses_packing_end) },
  { key: "proof_packing_url", label: "Bukti Packing", value: (s) => s.proof_packing_url ? "Ada" : "-", isUrl: true },
  { key: "loading_pic", label: "PIC Loading", value: (s) => s.loading_pic || "-" },
  { key: "loading_crew_count", label: "Crew Loading", value: (s) => (s.loading_crew_count ?? "-") },
  { key: "koli_per_loading_crew", label: "Koli/Crew Loading", value: (s) => perCrew(s.loading_koli, s.loading_crew_count) },
  { key: "tonnage_per_loading_crew", label: "Tonase DO/Crew Loading", value: (s) => perCrew(s.tonnage, s.loading_crew_count) },
  { key: "loading_koli", label: "Jml Koli", value: (s) => (s.loading_koli ?? "-") },
  { key: "loading_koli_status", label: "Status Koli", value: (s) => statusTonase(s.loading_koli_status) },
  { key: "timestamp_proses_loading", label: "Mulai Loading", value: (s) => formatTimestamp(s.timestamp_proses_loading) },
  { key: "timestamp_proses_loading_end", label: "Selesai Loading", value: (s) => formatTimestamp(s.timestamp_proses_loading_end) },
  { key: "durasi_loading", label: "Durasi Loading", value: (s) => procDuration(s.timestamp_proses_loading, s.timestamp_proses_loading_end) },
  { key: "timestamp_sudah_dikirim", label: "Waktu Dikirim", value: (s) => formatTimestamp(s.timestamp_sudah_dikirim) },
  { key: "proof_file_url", label: "Bukti Pengiriman", value: (s) => s.proof_file_url ? "Ada" : "-", isUrl: true },
  { key: "actual_arrival_date", label: "Aktual Tiba", value: (s) => s.actual_arrival_date || "-" },
  { key: "accuracy", label: "Akurasi", value: (s) => s.accuracy ? (accuracyMeta[s.accuracy]?.label || s.accuracy) : "-" },
  { key: "complaint_reason", label: "Alasan Komplain", value: (s) => s.complaint_reason || "-" },
  { key: "complaint_type", label: "Tipe Komplain", value: (s) => arrToStr(s.complaint_type, COMPLAINT_TYPE_LABELS) },
  { key: "complaint_category", label: "Kategori Komplain", value: (s) => arrToStr(s.complaint_category, COMPLAINT_CATEGORY_LABELS) },
  { key: "rescheduled_from_date", label: "Dari Tanggal", value: (s) => s.rescheduled_from_date || "-" },
  { key: "reschedule_reason", label: "Alasan Reschedule", value: (s) => s.reschedule_reason || "-" },
  { key: "reschedule_note", label: "Catatan Reschedule", value: (s) => s.reschedule_note || "-" },
];

const DALAM_PROSES = ["proses_picking", "menunggu_packing", "proses_packing", "menunggu_loading", "proses_loading"];
const filterByStatus = (list, status) =>
  status === "all" ? list
    : status === "dalam_proses" ? list.filter((s) => DALAM_PROSES.includes(s.status))
    : list.filter((s) => s.status === status);

export default function ReportFullDetail({ shipments, status }) {
  const [selected, setSelected] = useState(null);
  const filtered = filterByStatus(shipments, status);
  const exportValue = (s, col) => (col.isUrl ? (s[col.key] || "-") : col.value(s));

  const download = () => {
    const header = COLUMNS.map((c) => c.label);
    const rows = filtered.map((s) => COLUMNS.map((c) => exportValue(s, c)));
    const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
    ws["!cols"] = header.map(() => ({ wch: 18 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Detail Lengkap");
    XLSX.writeFile(wb, "detail-lengkap-pengiriman.xlsx", { bookType: "xlsx" });
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-slate-500">{filtered.length} pengiriman · menampilkan seluruh kolom detail tiap proses & status · klik baris untuk lihat dokumen DO</p>
        <button onClick={download} disabled={!filtered.length} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"><Download className="h-4 w-4" />Download</button>
      </div>
      {filtered.length === 0 ? <p className="text-sm text-slate-400">Tidak ada data sesuai filter ini.</p> :
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="overflow-auto max-h-[70vh]"><table className="w-full text-left text-sm">
          <thead className="sticky top-0 z-10 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 whitespace-nowrap shadow-sm"><tr>
            {COLUMNS.map((c) => <th key={c.key} className="px-3 py-3">{c.label}</th>)}
          </tr></thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((s) => (
              <tr key={s.id} onClick={() => setSelected(s)} className="cursor-pointer align-top transition hover:bg-indigo-50/60">
                {COLUMNS.map((c) => <td key={c.key} className="px-3 py-3 whitespace-nowrap text-slate-600">{c.value(s)}</td>)}
              </tr>
            ))}
          </tbody>
        </table></div></div>}
      <ReportDoPdfDialog shipment={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
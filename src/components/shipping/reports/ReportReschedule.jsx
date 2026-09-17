import { Download } from "lucide-react";
import * as XLSX from "xlsx";

export default function ReportReschedule({ shipments }) {
  const list = (shipments || []).filter((s) => s.rescheduled_from_date);

  const download = () => {
    const header = ["Tanggal Baru", "Tanggal Lama", "Gudang", "Tujuan", "Armada", "Tonase (kg)", "Alasan", "Catatan"];
    const rows = list.map((s) => [s.delivery_date, s.rescheduled_from_date, s.warehouse, s.outlet_name, s.fleet || "-", Number(s.tonnage || 0), s.reschedule_reason || "-", s.reschedule_note || "-"]);
    const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
    ws["!cols"] = [{ wch: 12 }, { wch: 12 }, { wch: 16 }, { wch: 18 }, { wch: 14 }, { wch: 12 }, { wch: 30 }, { wch: 40 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Reschedule");
    XLSX.writeFile(wb, "report-reschedule.xlsx", { bookType: "xlsx" });
  };

  return <div>
    <div className="mb-3 flex items-center justify-between">
      <p className="text-sm text-slate-500">{list.length} pengiriman di-reschedule</p>
      <button onClick={download} disabled={!list.length} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"><Download className="h-4 w-4" />Download</button>
    </div>
    {list.length === 0 ? <p className="text-sm text-slate-400">Tidak ada pengiriman di-reschedule pada rentang ini.</p> :
      <div className="space-y-2">
        {list.map((s) => (
          <div key={s.id} className="rounded-xl border border-amber-200 bg-amber-50/40 p-3">
            <div className="flex items-center justify-between gap-2"><p className="truncate font-semibold">{s.outlet_name}</p><span className="shrink-0 text-xs font-semibold text-amber-700">Reschedule</span></div>
            <p className="mt-1 text-xs text-slate-500">{s.rescheduled_from_date} → {s.delivery_date} · {s.warehouse} · Armada: {s.fleet || "-"}</p>
            {s.reschedule_reason && <p className="mt-1 text-xs text-slate-500">Alasan: {s.reschedule_reason}</p>}
          </div>
        ))}
      </div>}
  </div>;
}
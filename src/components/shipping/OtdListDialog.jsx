import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatTonnage, statusMeta } from "./shippingUtils";
import { computeEstimatedArrival } from "./etaUtils";

const daysDiff = (a, b) => {
  if (!a || !b) return null;
  const d1 = new Date(`${a}T00:00:00`);
  const d2 = new Date(`${b}T00:00:00`);
  return Math.round((d2 - d1) / 86400000);
};

export default function OtdListDialog({ open, onClose, title, icon: Icon, iconColor = "text-emerald-600", shipments = [], etaMap, emptyText = "Tidak ada data." }) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">{Icon && <Icon className={`h-5 w-5 ${iconColor}`} />}{title} ({shipments.length})</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          {shipments.length === 0 ? <p className="text-sm text-slate-400">{emptyText}</p> :
            shipments.map((s) => {
              const meta = statusMeta[s.status] || statusMeta.menunggu_antrian;
              const est = computeEstimatedArrival(s, etaMap);
              const act = s.actual_arrival_date;
              const late = est && act ? daysDiff(est, act) : null;
              const note = late == null ? "-" : late <= 0 ? "Tepat Waktu" : `Terlambat ${late} hari`;
              return (
                <div key={s.id} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="min-w-0 flex-1 truncate font-semibold">{s.outlet_name}</p>
                    <span className={`inline-flex shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${late > 0 ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"}`}>{note}</span>
                  </div>
                  <p className="mt-1 break-words text-xs text-slate-400">{s.delivery_date} · Armada: {s.fleet || "-"} · {s.warehouse}</p>
                  <p className="mt-1 break-words text-xs text-slate-500">Tonase: {formatTonnage(s.tonnage)}{s.do_number ? ` · DO: ${s.do_number}` : ""}</p>
                  <p className="mt-1 text-xs text-slate-500">Estimasi Tiba: {est || "-"} · Aktual Tiba: {act || "-"}</p>
                </div>
              );
            })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
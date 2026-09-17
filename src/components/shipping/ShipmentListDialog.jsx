import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatTonnage, statusMeta } from "./shippingUtils";

export default function ShipmentListDialog({ open, onClose, title, icon: Icon, iconColor = "text-indigo-600", shipments = [], emptyText = "Tidak ada data." }) {
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
              return (
                <div key={s.id} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="min-w-0 flex-1 truncate font-semibold">{s.outlet_name}</p>
                    <span className={`inline-flex shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${meta.className}`}>{meta.label}</span>
                  </div>
                  <p className="mt-1 break-words text-xs text-slate-400">{s.delivery_date} · Armada: {s.fleet || "-"} · {s.warehouse}</p>
                  <p className="mt-1 break-words text-xs text-slate-500">Tonase: {formatTonnage(s.tonnage)}{s.checker_name ? ` · Checker: ${s.checker_name}` : ""}{s.do_number ? ` · DO: ${s.do_number}` : ""}</p>
                </div>
              );
            })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
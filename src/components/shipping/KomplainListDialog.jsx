import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertTriangle } from "lucide-react";
import { formatTonnage, statusMeta } from "./shippingUtils";

export default function KomplainListDialog({ open, onClose, shipments = [] }) {
  const list = (shipments || []).filter((s) => s.accuracy === "ada_komplain");
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-rose-600" />Pengiriman dengan Akurasi Ada Komplain ({list.length})</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          {list.length === 0 ? <p className="text-sm text-slate-400">Tidak ada data.</p> :
            list.map((s) => {
              const meta = statusMeta[s.status] || statusMeta.menunggu_antrian;
              return (
                <div key={s.id} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-semibold">{s.outlet_name}</p>
                    <span className={`inline-flex shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${meta.className}`}>{meta.label}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">{s.delivery_date} · Armada: {s.fleet || "-"} · {s.warehouse}</p>
                  <p className="mt-1 text-xs text-slate-500">Tonase: {formatTonnage(s.tonnage)}{s.checker_name ? ` · Checker: ${s.checker_name}` : ""}{s.do_number ? ` · DO: ${s.do_number}` : ""}</p>
                  {s.complaint_reason && <p className="mt-1 text-xs font-medium text-rose-600">Alasan Komplain: {s.complaint_reason}</p>}
                </div>
              );
            })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
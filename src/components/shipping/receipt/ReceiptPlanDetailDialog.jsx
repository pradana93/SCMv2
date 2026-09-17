import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, Play, FileText } from "lucide-react";
import { formatTimestamp } from "@/components/shipping/shippingUtils";

const STATUS_META = {
  rencana: { label: "Rencana", className: "bg-amber-50 text-amber-700" },
  selesai: { label: "Selesai", className: "bg-emerald-50 text-emerald-700" },
};

export default function ReceiptPlanDetailDialog({ open, onClose, record, remainingItems, processes, canEdit, canDelete, hasRemaining, isAutoCreated, onEdit, onDelete, onReceive }) {
  if (!record) return null;
  const procs = processes || [];
  const items = remainingItems || record.items || [];
  const m = STATUS_META[record.status] || { label: record.status, className: "bg-slate-100 text-slate-500" };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detail Rencana Kedatangan</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-800">{record.sender_name || "-"}</p>
              <p className="text-xs text-slate-400">{record.arrival_date || "-"} · {record.warehouse || "-"}</p>
              {isAutoCreated && <p className="mt-0.5 text-[10px] font-semibold text-blue-600">Auto-created dari pengiriman (tidak dapat diedit)</p>}
            </div>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${m.className}`}>{m.label}</span>
          </div>
          {procs.length > 0 && <p className="text-[10px] font-semibold text-amber-600">{procs.length}× proses penerimaan</p>}

          <div className="rounded-xl bg-slate-50 px-3 py-2.5">
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{procs.length > 0 ? "Sisa & Diterima" : "Barang yang Akan Datang"}</p>
            <div className="space-y-1.5">
              {items.length === 0 && <p className="text-xs text-slate-400">Tidak ada barang.</p>}
              {items.map((it, idx) => (
                <div key={idx} className="flex items-center justify-between gap-2 text-xs">
                  <span className="min-w-0 truncate text-slate-700">{it.item_name}</span>
                  <span className="shrink-0">
                    {procs.length > 0 ? (
                      <>
                        {it.received > 0 && <span className="font-semibold text-emerald-600">{Number(it.received).toLocaleString("id-ID")} {it.unit || ""}</span>}
                        {it.received > 0 && it.remaining > 0 && <span className="text-slate-400"> / </span>}
                        {it.remaining > 0 && <span className="font-semibold text-rose-600">kurang {Number(it.remaining).toLocaleString("id-ID")} {it.unit || ""}</span>}
                        {it.received === 0 && <span className="text-slate-500">{Number(it.quantity || 0).toLocaleString("id-ID")} {it.unit || ""}</span>}
                      </>
                    ) : (
                      <span className="font-semibold text-slate-800">{Number(it.quantity || 0).toLocaleString("id-ID")} {it.unit || ""}{it.tonnage ? <span className="ml-1 text-slate-400">· {Number(it.tonnage).toLocaleString("id-ID")} kg</span> : null}</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {record.note && <p className="text-xs text-slate-500">Catatan: {record.note}</p>}

          {Array.isArray(record.status_history) && record.status_history.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Riwayat Status</p>
              <div className="max-h-32 space-y-1 overflow-y-auto text-xs">
                {[...record.status_history].reverse().map((h, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                    <span className="font-medium text-slate-700">{h.status || "-"}</span>
                    {h.note && <span className="text-slate-500">· {h.note}</span>}
                    <span className="text-slate-400">·</span>
                    <span className="text-slate-600">{h.by || "-"}</span>
                    <span className="text-slate-400">·</span>
                    <span className="text-slate-400">{formatTimestamp(h.timestamp)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-end gap-1.5 border-t border-slate-100 pt-3">
            {hasRemaining && canEdit && <button onClick={onReceive} className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700"><Play className="h-3.5 w-3.5" />{procs.length > 0 ? "Lanjut Penerimaan" : "Buat Proses Penerimaan"}</button>}
            {canEdit && !isAutoCreated && <button onClick={onEdit} className="rounded-lg p-1.5 text-slate-600 transition hover:bg-slate-100" title="Edit"><Pencil className="h-3.5 w-3.5" /></button>}
            {canDelete && <button onClick={onDelete} className="rounded-lg p-1.5 text-red-600 transition hover:bg-red-50" title="Hapus"><Trash2 className="h-3.5 w-3.5" /></button>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
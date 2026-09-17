import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ClipboardList } from "lucide-react";

export default function ProductionRequestListDialog({ open, onClose, requests = [] }) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ClipboardList className="h-5 w-5 text-violet-600" />Daftar Permintaan Produksi</DialogTitle>
        </DialogHeader>
        <p className="-mt-2 text-xs text-slate-500">{requests.length} permintaan telah dibuat di Manajemen Produksi.</p>
        <div className="max-h-[60vh] space-y-2 overflow-y-auto">
          {requests.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-400">Belum ada permintaan produksi.</div>
          ) : requests.map((r) => {
            const requested = Number(r.requested_quantity || 0);
            const fulfilled = r.status === "selesai";
            return (
              <div key={r.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-800">{r.item_name}</p>
                    <p className="text-xs text-slate-400">{r.request_date || "-"} · {r.warehouse || "-"}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${fulfilled ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{fulfilled ? "Selesai" : "Open"}</span>
                </div>
                <div className="mt-2 flex items-center gap-3 text-xs">
                  <span className="text-slate-500">Diminta: <span className="font-bold text-slate-800">{requested.toLocaleString("id-ID")} {r.unit || ""}</span></span>
                  {r.note && <span className="truncate text-slate-400">· {r.note}</span>}
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
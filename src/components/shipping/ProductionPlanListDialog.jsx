import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ProductionTimeline from "@/components/shipping/production/ProductionTimeline";

export default function ProductionPlanListDialog({ open, onClose, records, reqMap, title = "Daftar Rencana Produksi" }) {
  const list = records || [];
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <p className="text-xs text-slate-500">{list.length} data</p>
        <div className="mt-3 max-h-[60vh] space-y-2 overflow-auto">
          {list.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400">Belum ada rencana produksi pada rentang ini.</div>
          ) : list.map((p) => (
            <div key={p.id} className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-800">{p.item_name}</p>
                  <p className="text-xs text-slate-400">{p.plan_date || "-"} · {p.warehouse || "-"} · Crew {p.crew_count || 0}</p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${p.status === "selesai" ? "bg-emerald-50 text-emerald-700" : p.status === "dalam_proses" ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"}`}>{p.status === "selesai" ? "Selesai" : p.status === "dalam_proses" ? "Dalam Proses" : "Rencana"}</span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg bg-slate-50 px-2.5 py-1.5"><p className="text-slate-400">Rencana</p><p className="font-bold text-slate-800">{Number(p.planned_quantity || 0).toLocaleString("id-ID")} {p.unit || ""}</p></div>
                <div className="rounded-lg bg-emerald-50 px-2.5 py-1.5"><p className="text-emerald-500">Aktual</p><p className="font-bold text-emerald-700">{p.status === "selesai" ? `${Number(p.actual_quantity || 0).toLocaleString("id-ID")} ${p.unit || ""}` : "-"}</p></div>
              </div>
              <ProductionTimeline record={p} reqMap={reqMap} />
              {p.note && <p className="mt-1.5 text-xs text-slate-500">Catatan: {p.note}</p>}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
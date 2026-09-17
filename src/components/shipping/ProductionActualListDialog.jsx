import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ProductionTimeline from "@/components/shipping/production/ProductionTimeline";

export default function ProductionActualListDialog({ open, onClose, records, reqMap }) {
  const [onlyDiff, setOnlyDiff] = useState(false);
  const list = (records || []).filter((p) => p.status === "selesai");
  const shown = onlyDiff ? list.filter((p) => Number(p.actual_quantity || 0) !== Number(p.planned_quantity || 0)) : list;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader><DialogTitle>Daftar Aktual Produksi</DialogTitle></DialogHeader>
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500">{shown.length} catatan aktual</p>
          <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
            <input type="checkbox" checked={onlyDiff} onChange={(e) => setOnlyDiff(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
            Hanya yang berbeda dengan rencana
          </label>
        </div>
        <div className="mt-3 max-h-[60vh] space-y-2 overflow-auto">
          {shown.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400">Belum ada data aktual produksi.</div>
          ) : shown.map((p) => {
            const plan = Number(p.planned_quantity || 0);
            const actual = Number(p.actual_quantity || 0);
            const diff = actual - plan;
            const pos = diff > 0;
            const neg = diff < 0;
            return (
              <div key={p.id} className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-800">{p.item_name}</p>
                    <p className="text-xs text-slate-400">{p.actual_date || p.plan_date || "-"} · {p.warehouse || "-"}</p>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">Selesai</span>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                  <div className="rounded-lg bg-slate-50 px-2.5 py-1.5"><p className="text-slate-400">Rencana</p><p className="font-bold text-slate-800">{plan.toLocaleString("id-ID")} {p.unit || ""}</p></div>
                  <div className="rounded-lg bg-emerald-50 px-2.5 py-1.5"><p className="text-emerald-500">Aktual</p><p className="font-bold text-emerald-700">{actual.toLocaleString("id-ID")} {p.unit || ""}</p></div>
                  <div className="rounded-lg bg-violet-50 px-2.5 py-1.5"><p className="text-violet-400">Selisih</p><p className={`font-bold ${pos ? "text-emerald-700" : neg ? "text-rose-700" : "text-slate-600"}`}>{pos ? "+" : ""}{diff.toLocaleString("id-ID")} {p.unit || ""}</p></div>
                </div>
                <ProductionTimeline record={p} reqMap={reqMap} />
                {p.actual_note && <p className="mt-1.5 text-xs text-slate-500">Catatan: {p.actual_note}</p>}
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
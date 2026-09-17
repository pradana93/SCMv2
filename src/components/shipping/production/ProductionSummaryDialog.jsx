import { useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ProductionSummaryTable from "./ProductionSummaryTable";
import ProcessTimer from "@/components/shipping/ProcessTimer";

const statusMap = {
  menunggu_proses: { label: "Menunggu Proses", cls: "bg-amber-50 text-amber-700" },
  dalam_proses: { label: "Dalam Proses", cls: "bg-blue-50 text-blue-700" },
  menunggu_verifikasi: { label: "Menunggu Verifikasi", cls: "bg-violet-50 text-violet-700" },
  dalam_pembekuan: { label: "Dalam Pembekuan", cls: "bg-cyan-50 text-cyan-700" },
  selesai: { label: "Selesai", cls: "bg-emerald-50 text-emerald-700" },
};
const badge = (s) => { const m = statusMap[s] || { label: s, cls: "bg-slate-100 text-slate-500" }; return <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${m.cls}`}>{m.label}</span>; };

export default function ProductionSummaryDialog({ open, onClose, requests = [], productions = [], processes = [] }) {
  const [detailReq, setDetailReq] = useState(null);

  const plans = useMemo(() => (detailReq ? productions.filter((p) => p.request_id === detailReq.id) : []), [detailReq, productions]);
  const procsByPlan = useMemo(() => {
    const m = new Map();
    for (const p of processes) { if (!p.plan_id) continue; if (!m.has(p.plan_id)) m.set(p.plan_id, []); m.get(p.plan_id).push(p); }
    return m;
  }, [processes]);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setDetailReq(null); onClose(); } }}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {detailReq ? (
              <>
                <button onClick={() => setDetailReq(null)} className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"><ArrowLeft className="h-4 w-4" /></button>
                Detail Produksi — {detailReq.item_name}
              </>
            ) : "Ringkasan Produksi"}
          </DialogTitle>
        </DialogHeader>
        <div className="max-h-[70vh] overflow-y-auto">
          {detailReq ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="rounded-xl bg-slate-50 px-3 py-2"><p className="text-xs text-slate-400">Diminta</p><p className="text-sm font-bold text-slate-800">{Number(detailReq.requested_quantity || 0).toLocaleString("id-ID")} {detailReq.unit || ""}</p></div>
                <div className="rounded-xl bg-slate-50 px-3 py-2"><p className="text-xs text-slate-400">Tanggal</p><p className="text-sm font-bold text-slate-800">{detailReq.request_date || "-"}</p></div>
                <div className="rounded-xl bg-slate-50 px-3 py-2"><p className="text-xs text-slate-400">Gudang</p><p className="text-sm font-bold text-slate-800">{detailReq.warehouse || "-"}</p></div>
                <div className="rounded-xl bg-slate-50 px-3 py-2"><p className="text-xs text-slate-400">Status</p><p className="text-sm font-bold text-slate-800">{detailReq.status || "-"}</p></div>
              </div>
              {detailReq.note && <p className="text-xs text-slate-500">Catatan: {detailReq.note}</p>}
              {plans.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-400">Belum ada rencana produksi untuk permintaan ini.</p>
              ) : plans.map((pl) => {
                const ps = procsByPlan.get(pl.id) || [];
                return (
                  <div key={pl.id} className="rounded-xl border border-slate-200 p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-800">{pl.plan_date} · {Number(pl.planned_quantity || 0).toLocaleString("id-ID")} {pl.unit || ""}</p>
                      <span className="text-xs text-slate-400">{ps.length} proses</span>
                    </div>
                    {ps.length === 0 ? <p className="mt-2 text-xs text-slate-400">Belum ada proses.</p> : (
                      <div className="mt-2 space-y-1.5">
                        {ps.map((p, i) => (
                          <div key={p.id} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs">
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-700">Proses {i + 1} · {Number(p.round_quantity || 0).toLocaleString("id-ID")} {p.unit || ""}</p>
                              <p className="text-slate-400">
                                Aktual: {p.actual_quantity != null ? `${Number(p.actual_quantity).toLocaleString("id-ID")} ${p.unit || ""}` : "-"}
                                {p.timestamp_start && <> · <ProcessTimer start={p.timestamp_start} end={p.timestamp_end} mode="hms" /></>}
                              </p>
                            </div>
                            {badge(p.status)}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <ProductionSummaryTable requests={requests} productions={productions} processes={processes} onRowClick={setDetailReq} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
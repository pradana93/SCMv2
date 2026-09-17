import { useMemo, useState } from "react";
import { ArrowLeft, Search, ClipboardList } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ProcessTimer from "@/components/shipping/ProcessTimer";
import { formatTimestamp } from "@/components/shipping/shippingUtils";

const normKey = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const STATUS_META = {
  rencana: { label: "Rencana", cls: "bg-amber-50 text-amber-700" },
  selesai: { label: "Selesai", cls: "bg-emerald-50 text-emerald-700" },
  dalam_proses: { label: "Dalam Proses", cls: "bg-blue-50 text-blue-700" },
  menunggu_verifikasi: { label: "Menunggu Verifikasi", cls: "bg-violet-50 text-violet-700" },
  diterima: { label: "Diterima", cls: "bg-emerald-50 text-emerald-700" },
  ditutup: { label: "Ditutup", cls: "bg-slate-100 text-slate-500" },
};
const badge = (s) => { const m = STATUS_META[s] || { label: s, cls: "bg-slate-100 text-slate-500" }; return <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${m.cls}`}>{m.label}</span>; };

export default function ReceiptSummaryDialog({ open, onClose, receipts = [], processes = [], verifications = [] }) {
  const [q, setQ] = useState("");
  const [detail, setDetail] = useState(null);

  const rows = useMemo(() => receipts.map((r) => {
    const procs = processes.filter((p) => p.receipt_id === r.id);
    const planned = (r.items || []).reduce((s, it) => s + Number(it.quantity || 0), 0);
    const received = procs.reduce((s, p) => s + (p.received_items || []).reduce((a, it) => a + Number(it.quantity || 0), 0), 0);
    const isDone = r.status === "selesai" || procs.some((p) => p.status === "selesai");
    return { ...r, _planned: planned, _received: received, _procCount: procs.length, _isDone: isDone };
  }).sort((a, b) => (b.arrival_date || "").localeCompare(a.arrival_date || "")), [receipts, processes]);

  const query = q.trim().toLowerCase();
  const filtered = rows.filter((r) => !query || (r.sender_name || "").toLowerCase().includes(query) || (r.warehouse || "").toLowerCase().includes(query));

  const detailProcs = useMemo(() => (detail ? processes.filter((p) => p.receipt_id === detail.id) : []), [detail, processes]);
  const detailVerifs = useMemo(() => {
    if (!detail) return [];
    const procIds = new Set(detailProcs.map((p) => p.id));
    return verifications.filter((v) => procIds.has(v.process_id));
  }, [detail, detailProcs, verifications]);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setDetail(null); onClose(); } }}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {detail ? (
              <>
                <button onClick={() => setDetail(null)} className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"><ArrowLeft className="h-4 w-4" /></button>
                Detail Penerimaan — {detail.sender_name || "-"}
              </>
            ) : "Ringkasan Penerimaan"}
          </DialogTitle>
        </DialogHeader>
        <div className="max-h-[70vh] overflow-y-auto">
          {detail ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="rounded-xl bg-slate-50 px-3 py-2"><p className="text-xs text-slate-400">Vendor</p><p className="text-sm font-bold text-slate-800">{detail.sender_name || "-"}</p></div>
                <div className="rounded-xl bg-slate-50 px-3 py-2"><p className="text-xs text-slate-400">Tanggal</p><p className="text-sm font-bold text-slate-800">{detail.arrival_date || "-"}</p></div>
                <div className="rounded-xl bg-slate-50 px-3 py-2"><p className="text-xs text-slate-400">Gudang</p><p className="text-sm font-bold text-slate-800">{detail.warehouse || "-"}</p></div>
                <div className="rounded-xl bg-slate-50 px-3 py-2"><p className="text-xs text-slate-400">Status</p><div className="mt-0.5">{badge(detail.status)}</div></div>
              </div>
              <div className="rounded-xl border border-slate-200 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Barang Direncanakan</p>
                <div className="space-y-1">
                  {(detail.items || []).map((it, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className="text-slate-700">{it.item_name}</span>
                      <span className="font-semibold text-slate-800">{Number(it.quantity || 0).toLocaleString("id-ID")} {it.unit || ""}{it.tonnage ? ` · ${Number(it.tonnage).toLocaleString("id-ID")} kg` : ""}</span>
                    </div>
                  ))}
                </div>
              </div>
              {detailProcs.length === 0 ? <p className="py-4 text-center text-sm text-slate-400">Belum ada proses penerimaan.</p> : detailProcs.map((p, i) => (
                <div key={p.id} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-800">Proses {i + 1} · SK: {p.stock_keeper_name || "-"}</p>
                    {badge(p.status)}
                  </div>
                  {p.receive_start_ts && <p className="mt-1 text-xs text-slate-400">Durasi: <ProcessTimer start={p.receive_start_ts} end={p.receive_end_ts} mode="hms" /></p>}
                  <div className="mt-2 space-y-1">
                    {(p.received_items || []).map((it, j) => (
                      <div key={j} className="flex items-center justify-between text-xs">
                        <span className="text-slate-700">{it.item_name}</span>
                        <span className="font-semibold text-emerald-600">{Number(it.quantity || 0).toLocaleString("id-ID")} {it.unit || ""}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {detailVerifs.length > 0 && (
                <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-3">
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-500">Verifikasi ({detailVerifs.length})</p>
                  <div className="space-y-1">
                    {detailVerifs.map((v) => (
                      <div key={v.id} className="flex items-center justify-between text-xs">
                        <span className="text-slate-600">{v.verified_by || "-"} · {v.verified_date || "-"}</span>
                        {badge(v.status)}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {Array.isArray(detail.status_history) && detail.status_history.length > 0 && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Riwayat Status</p>
                  <div className="max-h-32 space-y-1 overflow-y-auto text-xs">
                    {[...detail.status_history].reverse().map((h, i) => (
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
            </div>
          ) : (
            <>
              <div className="relative mb-3 sm:w-72">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari vendor atau gudang..." className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-indigo-500" />
              </div>
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center"><ClipboardList className="h-8 w-8 text-slate-300" /><p className="mt-3 text-sm text-slate-500">Belum ada data penerimaan.</p></div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                        <th className="px-4 py-3">Vendor</th>
                        <th className="px-4 py-3">Tanggal</th>
                        <th className="px-4 py-3">Gudang</th>
                        <th className="px-4 py-3 text-right">Direncanakan</th>
                        <th className="px-4 py-3 text-right">Diterima</th>
                        <th className="px-4 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {filtered.map((r) => (
                        <tr key={r.id} onClick={() => setDetail(r)} className="cursor-pointer transition hover:bg-slate-50/60">
                          <td className="px-4 py-3 font-semibold text-slate-800">{r.sender_name || "-"}</td>
                          <td className="px-4 py-3 text-slate-500">{r.arrival_date || "-"}</td>
                          <td className="px-4 py-3 text-slate-500">{r.warehouse || "-"}</td>
                          <td className="px-4 py-3 text-right text-slate-700">{r._planned.toLocaleString("id-ID")}</td>
                          <td className="px-4 py-3 text-right font-semibold text-emerald-600">{r._received.toLocaleString("id-ID")}</td>
                          <td className="px-4 py-3">{badge(r._isDone ? "selesai" : r.status)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
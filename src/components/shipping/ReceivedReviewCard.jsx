import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Inbox } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import WarehouseMultiSelect from "@/components/shipping/WarehouseMultiSelect";
import DateRangeBar from "@/components/shipping/DateRangeBar";

const formatDate = (v) => {
  if (!v) return "-";
  try { return new Date(v + "T00:00:00").toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" }); } catch { return v; }
};
const normKey = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

export default function ReceivedReviewCard() {
  const today = new Date().toISOString().slice(0, 10);
  const [wh, setWh] = useState([]);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const isAllWh = !wh || wh.length === 0;
  const inDateRange = (d) => (!from || (d || "") >= from) && (!to || (d || "") <= to);
  const [showRencana, setShowRencana] = useState(false);
  const [showDiterima, setShowDiterima] = useState(false);
  const [showBelum, setShowBelum] = useState(false);
  const { data: allReceipts = [], isLoading } = useQuery({ queryKey: ["receipts", "review"], queryFn: () => base44.entities.Receipt.list("-arrival_date", 500) });
  const receipts = allReceipts.filter((r) => (isAllWh || wh.includes(r.warehouse)) && inDateRange(r.arrival_date));
  const { data: processes = [] } = useQuery({ queryKey: ["receiptProcesses", "review"], queryFn: () => base44.entities.ReceiptProcess.list("-created_date", 500) });

  const procsByReceipt = useMemo(() => {
    const map = new Map();
    for (const p of processes) { if (!p.receipt_id) continue; if (!map.has(p.receipt_id)) map.set(p.receipt_id, []); map.get(p.receipt_id).push(p); }
    return map;
  }, [processes]);

  const getReceivedMap = (r) => {
    const procs = procsByReceipt.get(r.id) || [];
    const map = new Map();
    for (const proc of procs) for (const it of (proc.received_items || [])) {
      const k = normKey(it.item_name);
      const ex = map.get(k) || { item_name: it.item_name, quantity: 0, unit: it.unit || "", tonnage: 0 };
      ex.quantity += Number(it.quantity || 0); ex.tonnage += Number(it.tonnage || 0);
      map.set(k, ex);
    }
    return map;
  };

  const getReceivedItems = (r) => Array.from(getReceivedMap(r).values());

  const isComplete = (r) => {
    const receivedMap = getReceivedMap(r);
    return (r.items || []).every((it) => (receivedMap.get(normKey(it.item_name))?.quantity || 0) >= Number(it.quantity || 0));
  };

  const hasProcesses = (r) => (procsByReceipt.get(r.id) || []).length > 0;

  const rencanaList = receipts.filter((r) => !hasProcesses(r) || !isComplete(r));
  const diterimaList = receipts.filter((r) => hasProcesses(r) && isComplete(r));
  const totalDiterimaItems = diterimaList.reduce((sum, r) => sum + getReceivedItems(r).length, 0);

  const belumDiterimaItems = receipts
    .filter((r) => hasProcesses(r) && !isComplete(r))
    .flatMap((r) => {
      const receivedMap = getReceivedMap(r);
      return (r.items || [])
        .filter((it) => Number(it.quantity || 0) > (receivedMap.get(normKey(it.item_name))?.quantity || 0))
        .map((it) => ({
          item_name: it.item_name,
          shortfall: Number(it.quantity || 0) - (receivedMap.get(normKey(it.item_name))?.quantity || 0),
          unit: it.unit || "",
          sender_name: r.sender_name,
          arrival_date: r.arrival_date,
          warehouse: r.warehouse,
        }));
    });

  return (
    <div className="mt-4 rounded-2xl border border-teal-200 bg-teal-50/40 p-5 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4">
        <div className="flex items-center gap-2">
          <Inbox className="h-5 w-5 text-teal-600" />
          <h2 className="text-sm font-bold text-slate-700">Received Review</h2>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <WarehouseMultiSelect value={wh} onChange={setWh} className="w-full sm:w-[200px]" />
          <DateRangeBar dateFrom={from} dateTo={to} onFromChange={setFrom} onToChange={setTo} />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <button type="button" onClick={() => !isLoading && setShowRencana(true)} disabled={isLoading} className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 text-left transition hover:bg-amber-100/60 disabled:opacity-70">
          <p className="text-xs font-medium text-slate-500">Total Rencana Penerimaan</p>
          <p className="mt-1 text-xl font-bold text-amber-600">{isLoading ? "—" : rencanaList.length}</p>
          <p className="mt-0.5 text-xs text-amber-600">{isLoading ? "" : `${rencanaList.length} rencana · Klik untuk lihat daftar`}</p>
        </button>
        <button type="button" onClick={() => !isLoading && setShowDiterima(true)} disabled={isLoading} className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 text-left transition hover:bg-emerald-100/60 disabled:opacity-70">
          <p className="text-xs font-medium text-slate-500">Total Penerimaan Selesai</p>
          <p className="mt-1 text-xl font-bold text-emerald-600">{isLoading ? "—" : totalDiterimaItems}</p>
          <p className="mt-0.5 text-xs text-emerald-600">{isLoading ? "" : `${totalDiterimaItems} barang · Klik untuk lihat daftar`}</p>
        </button>
        <button type="button" onClick={() => !isLoading && setShowBelum(true)} disabled={isLoading} className="rounded-xl border border-rose-200 bg-rose-50/50 p-4 text-left transition hover:bg-rose-100/60 disabled:opacity-70">
          <p className="text-xs font-medium text-slate-500">Total Belum Diterima</p>
          <p className="mt-1 text-xl font-bold text-rose-600">{isLoading ? "—" : belumDiterimaItems.length}</p>
          <p className="mt-0.5 text-xs text-rose-600">{isLoading ? "" : `${belumDiterimaItems.length} item · Klik untuk lihat daftar`}</p>
        </button>
      </div>

      {belumDiterimaItems.length > 0 && (
        <div className="mt-4 rounded-xl border border-rose-100 bg-white/70 p-4">
          <div className="mb-2 flex items-center gap-2">
            <Inbox className="h-4 w-4 text-rose-500" />
            <p className="text-sm font-bold text-slate-700">Sisa Target Penerimaan</p>
            <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-600">{belumDiterimaItems.length} item</span>
          </div>
          <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
            {receipts
              .filter((r) => hasProcesses(r) && !isComplete(r))
              .map((r) => {
                const receivedMap = getReceivedMap(r);
                const pending = (r.items || []).filter((it) => Number(it.quantity || 0) > (receivedMap.get(normKey(it.item_name))?.quantity || 0));
                if (pending.length === 0) return null;
                return (
                  <div key={r.id} className="rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-xs font-bold text-slate-700">{r.sender_name || "-"}</p>
                      <p className="shrink-0 text-[11px] text-slate-400">{formatDate(r.arrival_date)}</p>
                    </div>
                    <div className="mt-1 space-y-0.5">
                      {pending.map((it, i) => {
                        const received = receivedMap.get(normKey(it.item_name))?.quantity || 0;
                        const remaining = Number(it.quantity || 0) - received;
                        return (
                          <div key={i} className="text-[11px]">
                            <p className="truncate text-slate-600">{it.item_name}</p>
                            <div className="mt-0.5 flex items-center justify-between gap-1">
                              <span className="min-w-0 truncate">
                                <span className="font-semibold text-emerald-600">{received.toLocaleString("id-ID")}</span>
                                <span className="text-slate-300"> / </span>
                                <span className="text-slate-500">{Number(it.quantity || 0).toLocaleString("id-ID")} {it.unit || ""}</span>
                              </span>
                              <span className="shrink-0 rounded-full bg-rose-50 px-1.5 py-0.5 font-semibold text-rose-600">kurang {remaining.toLocaleString("id-ID")}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      <Dialog open={showRencana} onOpenChange={(o) => !o && setShowRencana(false)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Daftar Rencana Penerimaan</DialogTitle></DialogHeader>
          <div className="max-h-[55vh] space-y-2 overflow-y-auto">
            {rencanaList.length === 0 ? <p className="py-6 text-center text-sm text-slate-400">Belum ada rencana kedatangan.</p> :
              rencanaList.map((r) => (
                <div key={r.id} className="rounded-xl border border-slate-100 px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-slate-800">{r.sender_name || "-"}</p>
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">{hasProcesses(r) ? "Parsial" : "Rencana"}</span>
                  </div>
                  <p className="text-xs text-slate-400">{formatDate(r.arrival_date)} · {r.warehouse || "-"}</p>
                  <div className="mt-1 space-y-0.5">{(r.items || []).map((it, i) => (
                    <div key={i} className="flex justify-between text-xs"><span className="text-slate-600">{it.item_name}</span><span className="font-semibold text-slate-700">{Number(it.quantity || 0).toLocaleString("id-ID")} {it.unit || ""}</span></div>
                  ))}</div>
                </div>
              ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showDiterima} onOpenChange={(o) => !o && setShowDiterima(false)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Daftar Penerimaan Selesai</DialogTitle></DialogHeader>
          <div className="max-h-[55vh] space-y-2 overflow-y-auto">
            {diterimaList.length === 0 ? <p className="py-6 text-center text-sm text-slate-400">Belum ada penerimaan selesai.</p> :
              diterimaList.map((r) => (
                <div key={r.id} className="rounded-xl border border-slate-100 px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-slate-800">{r.sender_name || "-"}</p>
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">Diterima</span>
                  </div>
                  <p className="text-xs text-slate-400">{formatDate(r.arrival_date)} · {r.warehouse || "-"}</p>
                  <div className="mt-1 space-y-0.5">{getReceivedItems(r).map((it, i) => (
                    <div key={i} className="flex justify-between text-xs"><span className="text-slate-600">{it.item_name}</span><span className="font-semibold text-emerald-600">{Number(it.quantity || 0).toLocaleString("id-ID")} {it.unit || ""}</span></div>
                  ))}</div>
                </div>
              ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showBelum} onOpenChange={(o) => !o && setShowBelum(false)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Daftar Barang Belum Diterima</DialogTitle></DialogHeader>
          <div className="max-h-[55vh] space-y-2 overflow-y-auto">
            {belumDiterimaItems.length === 0 ? <p className="py-6 text-center text-sm text-slate-400">Tidak ada kekurangan barang.</p> :
              belumDiterimaItems.map((it, i) => (
                <div key={i} className="rounded-xl border border-rose-100 bg-rose-50/30 px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-slate-800">{it.item_name}</p>
                    <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-600">Kurang {Number(it.shortfall).toLocaleString("id-ID")} {it.unit || ""}</span>
                  </div>
                  <p className="text-xs text-slate-400">{it.sender_name || "-"} · {formatDate(it.arrival_date)} · {it.warehouse || "-"}</p>
                </div>
              ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
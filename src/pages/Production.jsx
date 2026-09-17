import { useMemo, useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Factory, Pencil, Trash2, Play, ClipboardList, CheckCircle2, Snowflake, ShieldCheck, LayoutList } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { usePermissions } from "@/components/shipping/usePermissions";
import ConfirmDeleteDialog from "@/components/shipping/master/ConfirmDeleteDialog";
import ProcessTimer from "@/components/shipping/ProcessTimer";
import { Button } from "@/components/ui/button";
import ProductionRequestDialog from "@/components/shipping/production/ProductionRequestDialog";
import ProductionPlanDialog from "@/components/shipping/production/ProductionPlanDialog";
import ProductionStartDialog from "@/components/shipping/production/ProductionStartDialog";
import ProductionFinishDialog from "@/components/shipping/production/ProductionFinishDialog";
import ProductionVerifyDialog from "@/components/shipping/production/ProductionVerifyDialog";
import ProductionSummaryDialog from "@/components/shipping/production/ProductionSummaryDialog";
import { useStockCurrent } from "@/components/shipping/useStockCurrent";
import ProductionShiftSummary from "@/components/shipping/production/ProductionShiftSummary";
import WarehouseMultiSelect from "@/components/shipping/WarehouseMultiSelect";
import DateRangeBar from "@/components/shipping/DateRangeBar";
import { useUserWarehouses } from "@/components/shipping/useUserWarehouses";

const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };

export default function Production() {
  const { can, canEdit, canDelete } = usePermissions();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { items } = useStockCurrent();
  const { userWarehouses, hasAll } = useUserWarehouses();
  const { data: requests = [], isLoading: loadingReq } = useQuery({ queryKey: ["productionRequests"], queryFn: () => base44.entities.ProductionRequest.list("-request_date", 500) });
  const { data: productions = [], isLoading: loadingProd } = useQuery({ queryKey: ["productions"], queryFn: () => base44.entities.Production.list("-plan_date", 500) });
  const { data: processes = [], isLoading: loadingProc } = useQuery({ queryKey: ["productionProcesses"], queryFn: () => base44.entities.ProductionProcess.list("-created_date", 500) });

  const canCreate = can("production.create");
  const canEditRec = canEdit("production.edit");
  const canDel = canDelete("production.delete");
  const canDelSelesai = canDelete("production.delete_selesai");

  const [tab, setTab] = useState("permintaan");
  const [reqOpen, setReqOpen] = useState(false);
  const [editingReq, setEditingReq] = useState(null);
  const [planOpen, setPlanOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [planFromReq, setPlanFromReq] = useState(null);
  const [startRec, setStartRec] = useState(null);
  const [finishRec, setFinishRec] = useState(null);
  const [verifyRec, setVerifyRec] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const summaryOpen = searchParams.get("production") === "1";
  const openSummary = () => { const next = new URLSearchParams(searchParams); next.set("production", "1"); setSearchParams(next); };
  const closeSummary = () => { const next = new URLSearchParams(searchParams); next.delete("production"); setSearchParams(next, { replace: true }); };
  const [confirmId, setConfirmId] = useState(null);
  const [confirmType, setConfirmType] = useState("plan");
  const [confirmBulk, setConfirmBulk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [whFilter, setWhFilter] = useState(hasAll ? [] : userWarehouses);
  useEffect(() => { if (!hasAll && userWarehouses.length) setWhFilter(userWarehouses); }, [hasAll, userWarehouses]);
  const [dateFrom, setDateFrom] = useState(daysAgo(6));
  const [dateTo, setDateTo] = useState(today());
  const [selectedIds, setSelectedIds] = useState(new Set());
  const isAllWh = !whFilter || whFilter.length === 0;
  const inDateRange = (d) => (!dateFrom || (d || "") >= dateFrom) && (!dateTo || (d || "") <= dateTo);
  const filteredRequests = requests.filter((r) => (isAllWh || whFilter.includes(r.warehouse)) && inDateRange(r.request_date));

  const userName = user?.full_name || user?.email || "-";
  const refresh = () => { qc.invalidateQueries({ queryKey: ["productions"] }); qc.invalidateQueries({ queryKey: ["productionRequests"] }); qc.invalidateQueries({ queryKey: ["productionProcesses"] }); };
  const addHistory = (rec, status, note) => [...(Array.isArray(rec?.status_history) ? rec.status_history : []), { status, timestamp: new Date().toISOString(), note, by: userName }];

  const planSumByReq = useMemo(() => {
    const map = new Map();
    for (const p of productions) { if (!p.request_id) continue; map.set(p.request_id, (map.get(p.request_id) || 0) + Number(p.planned_quantity || 0)); }
    return map;
  }, [productions]);

  const fulfilledByReq = useMemo(() => {
    const map = new Map();
    for (const p of processes) { if (!p.request_id || p.status !== "selesai") continue; map.set(p.request_id, (map.get(p.request_id) || 0) + (Number(p.actual_quantity) || 0)); }
    return map;
  }, [processes]);

  const allocatedByPlan = useMemo(() => {
    const map = new Map();
    for (const p of processes) { if (!p.plan_id) continue; map.set(p.plan_id, (map.get(p.plan_id) || 0) + Number(p.round_quantity || 0)); }
    return map;
  }, [processes]);

  const processesByPlan = useMemo(() => {
    const map = new Map();
    for (const p of processes) { if (!p.plan_id) continue; if (!map.has(p.plan_id)) map.set(p.plan_id, []); map.get(p.plan_id).push(p); }
    return map;
  }, [processes]);

  const reqMap = useMemo(() => new Map(requests.map((r) => [r.id, r])), [requests]);

  const saveRequest = async (payload) => {
    setBusy(true);
    try { if (editingReq) await base44.entities.ProductionRequest.update(editingReq.id, payload); else await base44.entities.ProductionRequest.create(payload); setReqOpen(false); setEditingReq(null); refresh(); } finally { setBusy(false); }
  };

  const savePlan = async (payload) => {
    setBusy(true);
    try {
      if (payload.id) await base44.entities.Production.update(payload.id, payload);
      else await base44.entities.Production.create({ ...payload, status_history: [{ status: "menunggu_proses", timestamp: new Date().toISOString(), note: "Rencana dibuat", by: userName }] });
      setPlanOpen(false); setEditing(null); setPlanFromReq(null); refresh();
    } finally { setBusy(false); }
  };

  const startProcess = async (payload) => {
    setBusy(true);
    try {
      const plan = startRec || {};
      await base44.entities.ProductionProcess.create({
        plan_id: plan.id, request_id: plan.request_id || "", plan_date: plan.plan_date || today(),
        item_name: plan.item_name, unit: plan.unit || "", warehouse: plan.warehouse || "Gudang Jakarta",
        round_quantity: payload.round_quantity, crew_count: payload.crew_count, note: payload.note,
        status: "dalam_proses", timestamp_start: payload.timestamp_start,
        status_history: [{ status: "dalam_proses", timestamp: new Date().toISOString(), note: "Mulai proses produksi", by: userName }],
      });
      setStartRec(null); refresh();
    } finally { setBusy(false); }
  };

  const finishProcess = async (payload) => {
    setBusy(true);
    try {
      const rec = finishRec || {};
      await base44.entities.ProductionProcess.update(payload.id, {
        status: "menunggu_verifikasi", actual_date: payload.actual_date, actual_quantity: payload.actual_quantity,
        reject_quantity: payload.reject_quantity, reject_unit: payload.reject_unit, crew_count: payload.crew_count,
        pic_name: payload.pic_name, actual_note: payload.actual_note, timestamp_end: payload.timestamp_end,
        status_history: addHistory(rec, "menunggu_verifikasi", "Selesai produksi"),
      });
      setFinishRec(null); refresh();
    } finally { setBusy(false); }
  };

  const verifyProcess = async (payload) => {
    setBusy(true);
    try {
      const rec = verifyRec || {};
      if (payload.choice === "penyimpanan") {
        const ref = `ProductionProcess: ${payload.id}`;
        const qty = Number(rec.actual_quantity) || 0;
        if (qty > 0) await base44.entities.StockMovement.create({ item_name: rec.item_name, type: "masuk", quantity: qty, unit: rec.unit || "", warehouse: rec.warehouse || "Gudang Jakarta", note: "Hasil produksi", reference: ref, date: rec.actual_date || today() });
        await base44.entities.ProductionProcess.update(payload.id, { status: "selesai", status_history: addHistory(rec, "selesai", "Masuk ke penyimpanan") });
      } else if (payload.choice === "pembekuan") {
        await base44.entities.ProductionProcess.update(payload.id, { status: "dalam_pembekuan", freezing_actual_quantity: payload.freezing_actual_quantity, freezing_start_ts: payload.freezing_start_ts, status_history: addHistory(rec, "dalam_pembekuan", "Mulai proses pembekuan") });
      }
      setVerifyRec(null); refresh();
      qc.invalidateQueries({ queryKey: ["stockMovements"] }); qc.invalidateQueries({ queryKey: ["stockItems"] });
    } finally { setBusy(false); }
  };

  const finishFreezing = async (p) => {
    setBusy(true);
    try {
      const now = new Date().toISOString();
      const duration = p.freezing_start_ts ? Math.floor((new Date(now).getTime() - new Date(p.freezing_start_ts).getTime()) / 1000) : 0;
      const ref = `ProductionProcess: ${p.id}`;
      const qty = Number(p.freezing_actual_quantity || p.actual_quantity) || 0;
      if (qty > 0) await base44.entities.StockMovement.create({ item_name: p.item_name, type: "masuk", quantity: qty, unit: p.unit || "", warehouse: p.warehouse || "Gudang Jakarta", note: "Hasil produksi (setelah pembekuan)", reference: ref, date: today() });
      await base44.entities.ProductionProcess.update(p.id, { status: "selesai", freezing_end_ts: now, freezing_duration: duration, status_history: addHistory(p, "selesai", "Pembekuan selesai, stok masuk gudang") });
      refresh(); qc.invalidateQueries({ queryKey: ["stockMovements"] }); qc.invalidateQueries({ queryKey: ["stockItems"] });
    } finally { setBusy(false); }
  };

  const remove = async () => {
    if (confirmBulk) {
      setConfirmBulk(false);
      const ids = Array.from(selectedIds);
      if (!ids.length) return;
      setBusy(true);
      try {
        for (const id of ids) {
          const linkedPlans = productions.filter((p) => p.request_id === id);
          for (const plan of linkedPlans) {
            const linkedProcs = processes.filter((p) => p.plan_id === plan.id);
            for (const proc of linkedProcs) { await base44.entities.StockMovement.deleteMany({ reference: `ProductionProcess: ${proc.id}` }).catch(() => {}); await base44.entities.ProductionProcess.delete(proc.id).catch(() => {}); }
            await base44.entities.Production.delete(plan.id).catch(() => {});
          }
          await base44.entities.ProductionRequest.delete(id).catch(() => {});
        }
        setSelectedIds(new Set());
        refresh(); qc.invalidateQueries({ queryKey: ["stockMovements"] }); qc.invalidateQueries({ queryKey: ["stockItems"] });
      } finally { setBusy(false); }
      return;
    }
    const id = confirmId; const type = confirmType; setConfirmId(null); setConfirmType("plan");
    if (!id) return;
    setBusy(true);
    try {
      if (type === "request") {
        const linkedPlans = productions.filter((p) => p.request_id === id);
        for (const plan of linkedPlans) {
          const linkedProcs = processes.filter((p) => p.plan_id === plan.id);
          for (const proc of linkedProcs) { await base44.entities.StockMovement.deleteMany({ reference: `ProductionProcess: ${proc.id}` }).catch(() => {}); await base44.entities.ProductionProcess.delete(proc.id).catch(() => {}); }
          await base44.entities.Production.delete(plan.id).catch(() => {});
        }
        await base44.entities.ProductionRequest.delete(id);
      } else if (type === "plan") {
        const linkedProcs = processes.filter((p) => p.plan_id === id);
        for (const proc of linkedProcs) { await base44.entities.StockMovement.deleteMany({ reference: `ProductionProcess: ${proc.id}` }).catch(() => {}); await base44.entities.ProductionProcess.delete(proc.id).catch(() => {}); }
        await base44.entities.Production.delete(id);
      } else if (type === "process") {
        await base44.entities.StockMovement.deleteMany({ reference: `ProductionProcess: ${id}` }).catch(() => {});
        await base44.entities.ProductionProcess.delete(id);
      }
      refresh(); qc.invalidateQueries({ queryKey: ["stockMovements"] }); qc.invalidateQueries({ queryKey: ["stockItems"] });
    } finally { setBusy(false); }
  };

  const statusBadge = (s) => {
    const map = { menunggu_proses: { label: "Menunggu Proses", cls: "bg-amber-50 text-amber-700" }, dalam_proses: { label: "Dalam Proses", cls: "bg-blue-50 text-blue-700" }, menunggu_verifikasi: { label: "Menunggu Verifikasi", cls: "bg-violet-50 text-violet-700" }, dalam_pembekuan: { label: "Dalam Pembekuan", cls: "bg-cyan-50 text-cyan-700" }, selesai: { label: "Selesai", cls: "bg-emerald-50 text-emerald-700" } };
    const m = map[s] || { label: s, cls: "bg-slate-100 text-slate-500" };
    return <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${m.cls}`}>{m.label}</span>;
  };

  const activeProcesses = processes.filter((p) => p.status !== "selesai");
  const selesaiProcesses = processes.filter((p) => p.status === "selesai");

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-indigo-600">Produksi</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Manajemen Produksi</h1>
          <p className="mt-2 text-sm text-slate-500">Kelola permintaan, rencana, dan proses produksi dengan timer, pembekuan, dan penyimpanan stok.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={openSummary} variant="outline" className="gap-1.5">
            <LayoutList className="h-4 w-4" /> Ringkasan
          </Button>
          {canCreate && tab === "permintaan" && (
            <Button onClick={() => { setEditingReq(null); setReqOpen(true); }} disabled={busy} className="gap-1.5">
              <Plus className="h-4 w-4" /> Tambah Permintaan
            </Button>
          )}
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm sm:flex sm:flex-wrap">
        <button onClick={() => setTab("permintaan")} className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition sm:text-sm ${tab === "permintaan" ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}><ClipboardList className="h-4 w-4 shrink-0" />Permintaan</button>
        <button onClick={() => setTab("rencana")} className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition sm:text-sm ${tab === "rencana" ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}><Factory className="h-4 w-4 shrink-0" />Rencana</button>
        <button onClick={() => setTab("dalam_proses")} className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition sm:text-sm ${tab === "dalam_proses" ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}><Play className="h-4 w-4 shrink-0" />Dalam Proses</button>
        <button onClick={() => setTab("selesai")} className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition sm:text-sm ${tab === "selesai" ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}><CheckCircle2 className="h-4 w-4 shrink-0" />Selesai</button>
      </div>

      {(tab === "dalam_proses" || tab === "selesai") && <ProductionShiftSummary processes={selesaiProcesses} />}

      {tab === "permintaan" ? (
        loadingReq ? <div className="flex justify-center py-16"><div className="h-7 w-7 animate-spin rounded-full border-4 border-indigo-100 border-t-indigo-600" /></div> :
        <>
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <WarehouseMultiSelect value={whFilter} onChange={setWhFilter} className="w-full sm:w-[240px]" />
            <DateRangeBar dateFrom={dateFrom} dateTo={dateTo} onFromChange={setDateFrom} onToChange={setDateTo} />
          </div>
          {filteredRequests.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center dark:border-slate-700 dark:bg-slate-800/40"><ClipboardList className="h-8 w-8 text-slate-300" /><p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Belum ada permintaan produksi. {canCreate && "Klik Tambah Permintaan untuk memulai."}</p></div>
          ) : (
            <>
              {canDel && (
                <div className="mb-3 flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 dark:border-slate-700 dark:bg-slate-800/40">
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300">
                    <input type="checkbox" checked={selectedIds.size === filteredRequests.length && filteredRequests.length > 0} onChange={(e) => setSelectedIds(e.target.checked ? new Set(filteredRequests.map((r) => r.id)) : new Set())} className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                    Pilih Semua ({filteredRequests.length})
                  </label>
                  {selectedIds.size > 0 && <button onClick={() => setConfirmBulk(true)} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"><Trash2 className="h-3.5 w-3.5" />Hapus {selectedIds.size} Terpilih</button>}
                </div>
              )}
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800/40">
                {filteredRequests.map((r) => {
                  const planned = planSumByReq.get(r.id) || 0;
                  const fulfilled = fulfilledByReq.get(r.id) || 0;
                  const requested = Number(r.requested_quantity || 0);
                  const remaining = Math.max(0, requested - planned);
                  const isComplete = fulfilled >= requested && requested > 0;
                  const isSelected = selectedIds.has(r.id);
                  return (
                    <div key={r.id} className={`flex items-start gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0 dark:border-slate-700/50 ${isSelected ? "bg-indigo-50/40 dark:bg-indigo-950/20" : ""}`}>
                      {canDel && <input type="checkbox" checked={isSelected} onChange={(e) => { const next = new Set(selectedIds); if (e.target.checked) next.add(r.id); else next.delete(r.id); setSelectedIds(next); }} className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0"><p className="truncate text-sm font-bold text-slate-800 dark:text-slate-100">{r.item_name}</p><p className="text-xs text-slate-400">{r.request_date || "-"} · {r.warehouse || "-"}</p></div>
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${isComplete ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{isComplete ? "Terpenuhi" : "Belum Terpenuhi"}</span>
                        </div>
                        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400">
                          <span>Diminta: <strong className="text-slate-700 dark:text-slate-200">{requested.toLocaleString("id-ID")} {r.unit || ""}</strong></span>
                          <span>Direncanakan: <strong className="text-slate-700 dark:text-slate-200">{planned.toLocaleString("id-ID")} {r.unit || ""}</strong></span>
                          <span className="text-emerald-600">Masuk Stok: <strong>{fulfilled.toLocaleString("id-ID")} {r.unit || ""}</strong></span>
                        </div>
                        {r.note && <p className="mt-1 text-xs text-slate-400">Catatan: {r.note}</p>}
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        {canCreate && remaining > 0 && <button onClick={() => { setEditing(null); setPlanFromReq(r); setPlanOpen(true); setTab("rencana"); }} disabled={busy} className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-700"><Plus className="h-3.5 w-3.5" /><span className="hidden sm:inline">Buat Rencana</span></button>}
                        {canEditRec && <button onClick={() => { setEditingReq(r); setReqOpen(true); }} disabled={busy} className="rounded-lg p-1.5 text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700" title="Edit"><Pencil className="h-3.5 w-3.5" /></button>}
                        {canDel && <button onClick={() => { setConfirmId(r.id); setConfirmType("request"); }} disabled={busy} className="rounded-lg p-1.5 text-red-600 transition hover:bg-red-50 dark:hover:bg-red-950/30" title="Hapus"><Trash2 className="h-3.5 w-3.5" /></button>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </>
      ) : tab === "rencana" ? (
        loadingProd ? <div className="flex justify-center py-16"><div className="h-7 w-7 animate-spin rounded-full border-4 border-indigo-100 border-t-indigo-600" /></div> :
        productions.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center"><Factory className="h-8 w-8 text-slate-300" /><p className="mt-3 text-sm text-slate-500">Belum ada rencana produksi. Buat dari tab Permintaan Produksi.</p></div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {productions.map((p) => {
              const req = p.request_id ? reqMap.get(p.request_id) : null;
              const allocated = allocatedByPlan.get(p.id) || 0;
              const remaining = Math.max(0, Number(p.planned_quantity || 0) - allocated);
              const planProcesses = processesByPlan.get(p.id) || [];
              return (
                <div key={p.id} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0"><p className="truncate text-sm font-bold text-slate-800">{p.item_name}</p><p className="text-xs text-slate-400">{p.plan_date || "-"} · {p.warehouse || "-"}</p></div>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${remaining > 0 ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>{remaining > 0 ? "Menunggu Proses" : "Selesai"}</span>
                  </div>
                  {req && <p className="mt-1 text-xs text-indigo-500">Permintaan: {Number(req.requested_quantity || 0).toLocaleString("id-ID")} {p.unit || ""} ({req.request_date || "-"})</p>}
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-xl bg-slate-50 px-3 py-2"><p className="text-slate-400">Kuantitas Rencana</p><p className="text-sm font-bold text-slate-800">{Number(p.planned_quantity || 0).toLocaleString("id-ID")} <span className="text-xs font-normal text-slate-400">{p.unit || ""}</span></p></div>
                    <div className="rounded-xl bg-slate-50 px-3 py-2"><p className="text-slate-400">Sudah Dialokasikan</p><p className="text-sm font-bold text-slate-800">{allocated.toLocaleString("id-ID")} <span className="text-xs font-normal text-slate-400">{p.unit || ""}</span></p></div>
                    {remaining > 0 && <div className="rounded-xl bg-indigo-50 px-3 py-2"><p className="text-indigo-400">Sisa Kekurangan</p><p className="text-sm font-bold text-indigo-700">{remaining.toLocaleString("id-ID")} <span className="text-xs font-normal text-indigo-300">{p.unit || ""}</span></p></div>}
                    {planProcesses.length > 0 && <div className="rounded-xl bg-blue-50 px-3 py-2"><p className="text-blue-400">Jumlah Proses</p><p className="text-sm font-bold text-blue-700">{planProcesses.length} proses</p></div>}
                  </div>
                  {p.note && <p className="mt-2 text-xs text-slate-500">Catatan: {p.note}</p>}
                  {planProcesses.length > 0 && (
                    <div className="mt-2 rounded-xl border border-slate-100 bg-slate-50/60 p-2.5">
                      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Proses Terkait ({planProcesses.length})</p>
                      <div className="space-y-1">
                        {planProcesses.map((proc, i) => (
                          <div key={proc.id} className="flex items-center justify-between gap-2 text-xs">
                            <span className="text-slate-500">Proses {i + 1}</span>
                            <span className="flex items-center gap-1.5"><span className="font-semibold text-slate-700">{Number(proc.round_quantity || 0).toLocaleString("id-ID")} {p.unit || ""}</span>{statusBadge(proc.status)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="mt-3 flex flex-wrap items-center justify-end gap-1 border-t border-slate-100 pt-2">
                    {remaining > 0 && canEditRec && <button onClick={() => setStartRec(p)} disabled={busy} className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700"><Play className="h-3.5 w-3.5" />Buat Proses</button>}
                    {canEditRec && <button onClick={() => { setEditing(p); setPlanFromReq(null); setPlanOpen(true); }} disabled={busy} className="rounded-lg p-1.5 text-slate-600 transition hover:bg-slate-100" title="Edit"><Pencil className="h-3.5 w-3.5" /></button>}
                    {canDel && <button onClick={() => { setConfirmId(p.id); setConfirmType("plan"); }} disabled={busy} className="rounded-lg p-1.5 text-red-600 transition hover:bg-red-50" title="Hapus"><Trash2 className="h-3.5 w-3.5" /></button>}
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : tab === "dalam_proses" ? (
        loadingProc ? <div className="flex justify-center py-16"><div className="h-7 w-7 animate-spin rounded-full border-4 border-indigo-100 border-t-indigo-600" /></div> :
        activeProcesses.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center"><Play className="h-8 w-8 text-slate-300" /><p className="mt-3 text-sm text-slate-500">Belum ada proses produksi. Buat dari tab Rencana Produksi.</p></div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {activeProcesses.map((p) => {
              const plan = p.plan_id ? (productions.find((pl) => pl.id === p.plan_id)) : null;
              return (
                <div key={p.id} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0"><p className="truncate text-sm font-bold text-slate-800">{p.item_name}</p><p className="text-xs text-slate-400">{p.plan_date || "-"} · {p.warehouse || "-"}{p.crew_count ? ` · Crew ${p.crew_count}` : ""}{p.pic_name ? ` · PIC ${p.pic_name}` : ""}</p></div>
                    {statusBadge(p.status)}
                  </div>
                  {plan && <p className="mt-1 text-xs text-indigo-500">Rencana: {Number(plan.planned_quantity || 0).toLocaleString("id-ID")} {p.unit || ""} ({plan.plan_date || "-"})</p>}
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-xl bg-slate-50 px-3 py-2"><p className="text-slate-400">Kuantitas Shift</p><p className="text-sm font-bold text-slate-800">{Number(p.round_quantity || 0).toLocaleString("id-ID")} <span className="text-xs font-normal text-slate-400">{p.unit || ""}</span></p></div>
                    <div className="rounded-xl bg-slate-50 px-3 py-2"><p className="text-slate-400">Aktual</p><p className="text-sm font-bold text-slate-800">{p.actual_quantity != null ? `${Number(p.actual_quantity).toLocaleString("id-ID")} ${p.unit || ""}` : "-"}</p>{p.reject_quantity > 0 && <p className="text-[11px] text-rose-500">Reject: {Number(p.reject_quantity).toLocaleString("id-ID")} {p.reject_unit || p.unit || ""}</p>}</div>
                    {p.timestamp_start && (
                      <div className="rounded-xl bg-blue-50 px-3 py-2"><p className="text-blue-400">Durasi Produksi</p><p className="text-sm font-bold text-blue-700"><ProcessTimer start={p.timestamp_start} end={p.timestamp_end} mode="hms" /></p></div>
                    )}
                    {p.status === "dalam_pembekuan" && p.freezing_start_ts && (
                      <div className="rounded-xl bg-cyan-50 px-3 py-2"><p className="text-cyan-400">Durasi Pembekuan</p><p className="text-sm font-bold text-cyan-700"><ProcessTimer start={p.freezing_start_ts} end={p.freezing_end_ts} mode="hms" /></p></div>
                    )}
                    {p.status === "selesai" && (
                      <div className="rounded-xl bg-emerald-50 px-3 py-2"><p className="text-emerald-400">Stok Masuk</p><p className="text-sm font-bold text-emerald-700">{Number(p.actual_quantity || 0).toLocaleString("id-ID")} {p.unit || ""}</p></div>
                    )}
                  </div>
                  {p.note && <p className="mt-2 text-xs text-slate-500">Catatan: {p.note}</p>}
                  {p.actual_note && <p className="mt-1 text-xs text-slate-500">Aktual: {p.actual_note}</p>}
                  <div className="mt-3 flex flex-wrap items-center justify-end gap-1 border-t border-slate-100 pt-2">
                    {p.status === "dalam_proses" && canEditRec && <button onClick={() => setFinishRec(p)} disabled={busy} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" />Selesai Proses</button>}
                    {p.status === "menunggu_verifikasi" && canEditRec && <button onClick={() => setVerifyRec(p)} disabled={busy} className="inline-flex items-center gap-1 rounded-lg bg-violet-600 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-violet-700"><ShieldCheck className="h-3.5 w-3.5" />Verifikasi</button>}
                    {p.status === "dalam_pembekuan" && canEditRec && <button onClick={() => finishFreezing(p)} disabled={busy} className="inline-flex items-center gap-1 rounded-lg bg-cyan-600 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-cyan-700"><Snowflake className="h-3.5 w-3.5" />Selesai Pembekuan</button>}
                    {canDel && <button onClick={() => { setConfirmId(p.id); setConfirmType("process"); }} disabled={busy} className="rounded-lg p-1.5 text-red-600 transition hover:bg-red-50" title="Hapus"><Trash2 className="h-3.5 w-3.5" /></button>}
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        selesaiProcesses.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center"><CheckCircle2 className="h-8 w-8 text-slate-300" /><p className="mt-3 text-sm text-slate-500">Belum ada produksi selesai.</p></div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {selesaiProcesses.map((p) => {
              const plan = p.plan_id ? (productions.find((pl) => pl.id === p.plan_id)) : null;
              return (
                <div key={p.id} className="flex flex-col rounded-2xl border border-emerald-200 bg-emerald-50/30 p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0"><p className="truncate text-sm font-bold text-slate-800">{p.item_name}</p><p className="text-xs text-slate-400">{p.actual_date || p.plan_date || "-"} · {p.warehouse || "-"}</p></div>
                    {statusBadge(p.status)}
                  </div>
                  {plan && <p className="mt-1 text-xs text-indigo-500">Rencana: {Number(plan.planned_quantity || 0).toLocaleString("id-ID")} {p.unit || ""}</p>}
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-xl bg-emerald-50 px-3 py-2"><p className="text-emerald-400">Stok Masuk</p><p className="text-sm font-bold text-emerald-700">{Number(p.actual_quantity || 0).toLocaleString("id-ID")} {p.unit || ""}</p></div>
                    <div className="rounded-xl bg-slate-50 px-3 py-2"><p className="text-slate-400">Kru</p><p className="text-sm font-bold text-slate-800">{p.crew_count || 0}</p></div>
                    {p.reject_quantity > 0 && <div className="rounded-xl bg-rose-50 px-3 py-2"><p className="text-rose-400">Reject</p><p className="text-sm font-bold text-rose-600">{Number(p.reject_quantity).toLocaleString("id-ID")} {p.reject_unit || p.unit || ""}</p></div>}
                    {p.freezing_duration > 0 && <div className="rounded-xl bg-cyan-50 px-3 py-2"><p className="text-cyan-400">Durasi Pembekuan</p><p className="text-sm font-bold text-cyan-700">{Math.floor(p.freezing_duration / 60)}m {p.freezing_duration % 60}s</p></div>}
                  </div>
                  {p.actual_note && <p className="mt-2 text-xs text-slate-500">Catatan: {p.actual_note}</p>}
                  <div className="mt-3 flex items-center justify-end gap-1 border-t border-slate-100 pt-2">
                    {canDelSelesai && <button onClick={() => { setConfirmId(p.id); setConfirmType("process"); }} disabled={busy} className="rounded-lg p-1.5 text-red-600 transition hover:bg-red-50" title="Hapus"><Trash2 className="h-3.5 w-3.5" /></button>}
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      <ProductionRequestDialog open={reqOpen} onClose={() => { setReqOpen(false); setEditingReq(null); }} onSave={saveRequest} items={items} editing={editingReq} busy={busy} />
      <ProductionPlanDialog open={planOpen} onClose={() => { setPlanOpen(false); setEditing(null); setPlanFromReq(null); }} onSave={savePlan} editing={editing} fromRequest={planFromReq} busy={busy} />
      <ProductionStartDialog open={!!startRec} onClose={() => setStartRec(null)} onSave={startProcess} record={startRec} processes={startRec ? (processesByPlan.get(startRec.id) || []) : []} busy={busy} />
      <ProductionFinishDialog open={!!finishRec} onClose={() => setFinishRec(null)} onSave={finishProcess} record={finishRec} busy={busy} />
      <ProductionVerifyDialog open={!!verifyRec} onClose={() => setVerifyRec(null)} onSave={verifyProcess} record={verifyRec} busy={busy} />
      <ProductionSummaryDialog open={summaryOpen} onClose={closeSummary} requests={requests} productions={productions} processes={processes} />
      <ConfirmDeleteDialog open={!!confirmId || confirmBulk} onClose={() => { setConfirmId(null); setConfirmBulk(false); }} onConfirm={remove} count={confirmBulk ? selectedIds.size : 1} />
    </div>
  );
}
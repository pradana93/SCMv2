import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Factory, ClipboardList } from "lucide-react";
import { base44 } from "@/api/base44Client";
import DateRangeBar from "@/components/shipping/DateRangeBar";
import WarehouseMultiSelect from "@/components/shipping/WarehouseMultiSelect";
import ProductionActualListDialog from "@/components/shipping/ProductionActualListDialog";
import ProductionPlanListDialog from "@/components/shipping/ProductionPlanListDialog";
import ProductionRequestListDialog from "@/components/shipping/production/ProductionRequestListDialog";

const todayStr = () => new Date().toISOString().slice(0, 10);

export default function ProductionReviewCard() {
  const today = todayStr();
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [wh, setWh] = useState([]);
  const isAllWh = !wh || wh.length === 0;
  const [showActual, setShowActual] = useState(false);
  const [showPlan, setShowPlan] = useState(false);
  const [showProcess, setShowProcess] = useState(false);
  const [showRequests, setShowRequests] = useState(false);

  const { data = [], isLoading } = useQuery({
    queryKey: ["productions", "review", from, to, wh],
    queryFn: async () => {
      const all = await base44.entities.Production.list("-plan_date", 500);
      return all.filter((p) => (!from || (p.plan_date || "") >= from) && (!to || (p.plan_date || "") <= to) && (isAllWh || wh.includes(p.warehouse)));
    },
  });
  const { data: processes = [] } = useQuery({ queryKey: ["productionProcesses"], queryFn: () => base44.entities.ProductionProcess.list("-created_date", 500) });
  const { data: reqs = [] } = useQuery({ queryKey: ["productionRequests", "review", from, to, wh], queryFn: async () => { const all = await base44.entities.ProductionRequest.list("-request_date", 500); return all.filter((r) => (!from || (r.request_date || "") >= from) && (!to || (r.request_date || "") <= to) && (isAllWh || wh.includes(r.warehouse))); } });
  const reqMap = useMemo(() => new Map(reqs.map((r) => [r.id, r])), [reqs]);

  const procsByPlan = useMemo(() => {
    const map = new Map();
    for (const p of processes) { if (!p.plan_id) continue; if (!map.has(p.plan_id)) map.set(p.plan_id, []); map.get(p.plan_id).push(p); }
    return map;
  }, [processes]);

  const enriched = useMemo(() => data.map((p) => {
    const procs = procsByPlan.get(p.id) || [];
    const doneProcs = procs.filter((pr) => pr.status === "selesai");
    const actualQty = doneProcs.reduce((s, pr) => s + (Number(pr.actual_quantity) || 0), 0);
    const isDone = actualQty >= Number(p.planned_quantity || 0) && Number(p.planned_quantity || 0) > 0;
    const inProc = procs.some((pr) => ["dalam_proses", "menunggu_verifikasi", "dalam_pembekuan"].includes(pr.status));
    return { ...p, actual_quantity: actualQty, crew_count: procs.reduce((s, pr) => s + (Number(pr.crew_count) || 0), 0), status: isDone ? "selesai" : inProc ? "dalam_proses" : "menunggu_proses" };
  }), [data, procsByPlan]);

  const totalPlan = enriched.reduce((s, p) => s + Number(p.planned_quantity || 0), 0);
  const done = enriched.filter((p) => p.status === "selesai");
  const inProcess = enriched.filter((p) => p.status === "dalam_proses");
  const totalActual = done.reduce((s, p) => s + Number(p.actual_quantity || 0), 0);
  const achievement = totalPlan > 0 ? Math.round((totalActual / totalPlan) * 1000) / 10 : 0;

  const perItem = (() => {
    const map = {};
    for (const p of enriched) {
      const name = p.item_name || "(Tanpa nama)";
      if (!map[name]) map[name] = { name, unit: p.unit || "", plan: 0, actual: 0 };
      map[name].plan += Number(p.planned_quantity || 0);
      if (p.status === "selesai") map[name].actual += Number(p.actual_quantity || 0);
    }
    return Object.values(map)
      .map((r) => ({ ...r, productivity: r.plan > 0 ? Math.round((r.actual / r.plan) * 1000) / 10 : 0 }))
      .sort((a, b) => b.actual - a.actual);
  })();

  return (
    <div className="mt-4 rounded-2xl border border-violet-200 bg-violet-50/40 p-5 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Factory className="h-5 w-5 text-violet-600" />
          <h2 className="text-sm font-bold text-slate-700">Production Review</h2>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <WarehouseMultiSelect value={wh} onChange={setWh} className="w-full sm:w-[200px]" />
          <DateRangeBar dateFrom={from} dateTo={to} onFromChange={setFrom} onToChange={setTo} />
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <button type="button" onClick={() => !isLoading && setShowRequests(true)} disabled={isLoading} className="rounded-xl border border-violet-200 bg-violet-50/50 p-4 text-left transition hover:bg-violet-100/60 disabled:opacity-70">
          <p className="text-xs font-medium text-slate-500">Total Permintaan Produksi</p>
          <p className="mt-1 text-xl font-bold text-violet-600">{isLoading ? "—" : reqs.length}</p>
          <p className="mt-0.5 text-xs text-violet-600">{isLoading ? "" : `${reqs.length} permintaan · Klik untuk lihat daftar`}</p>
        </button>
        <button type="button" onClick={() => !isLoading && setShowPlan(true)} disabled={isLoading} className="rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:bg-slate-50 disabled:opacity-70">
          <p className="text-xs font-medium text-slate-500">Total Production Plan</p>
          <p className="mt-1 text-xl font-bold text-slate-900">{isLoading ? "—" : Number(totalPlan).toLocaleString("id-ID")}</p>
          <p className="mt-0.5 text-xs text-slate-400">{isLoading ? "" : `${data.length} rencana · Klik untuk lihat daftar`}</p>
        </button>
        <button type="button" onClick={() => !isLoading && setShowActual(true)} disabled={isLoading} className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 text-left transition hover:bg-emerald-100/60 disabled:opacity-70">
          <p className="text-xs font-medium text-slate-500">Total Actual Production</p>
          <p className="mt-1 text-xl font-bold text-emerald-600">{isLoading ? "—" : Number(totalActual).toLocaleString("id-ID")}</p>
          <p className="mt-0.5 text-emerald-600 text-xs">{isLoading ? "" : `${done.length} selesai · Klik untuk lihat daftar`}</p>
        </button>
        <button type="button" onClick={() => !isLoading && setShowProcess(true)} disabled={isLoading} className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 text-left transition hover:bg-blue-100/60 disabled:opacity-70">
          <p className="text-xs font-medium text-slate-500">Dalam Proses</p>
          <p className="mt-1 text-xl font-bold text-blue-600">{isLoading ? "—" : inProcess.length}</p>
          <p className="mt-0.5 text-xs text-blue-600">{isLoading ? "" : `${inProcess.length} produksi · Klik untuk lihat daftar`}</p>
        </button>
        <div className="rounded-xl border border-violet-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Produktivitas</p>
          <p className={`mt-1 text-xl font-bold ${achievement >= 100 ? "text-emerald-700" : achievement >= 75 ? "text-amber-600" : "text-rose-600"}`}>{isLoading ? "—" : `${achievement}%`}</p>
          <p className="mt-0.5 text-xs text-slate-400">{isLoading ? "" : "Aktual ÷ Rencana"}</p>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="hidden grid-cols-12 gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 sm:grid">
          <div className="col-span-6">Barang</div>
          <div className="col-span-2 text-right">Rencana</div>
          <div className="col-span-2 text-right">Aktual</div>
          <div className="col-span-2 text-right">Produktivitas</div>
        </div>
        <div className="max-h-64 overflow-auto">
          {isLoading ? (
            <div className="px-4 py-6 text-center text-sm text-slate-400">Memuat data...</div>
          ) : perItem.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-slate-400">Belum ada data produksi pada rentang ini.</div>
          ) : perItem.map((r) => (
            <div key={r.name} className="border-b border-slate-50 px-4 py-2.5 last:border-0 sm:hidden">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-800">{r.name}</p>
                <p className="text-[11px] text-slate-400">{r.unit || "-"}</p>
              </div>
              <div className="mt-1.5 grid grid-cols-3 gap-2 text-xs">
                <div><span className="text-slate-400">Rencana </span><span className="text-slate-700">{Number(r.plan).toLocaleString("id-ID")}</span></div>
                <div><span className="text-slate-400">Aktual </span><span className="font-semibold text-emerald-700">{Number(r.actual).toLocaleString("id-ID")}</span></div>
                <div className="text-right"><span className={`font-bold ${r.productivity >= 100 ? "text-emerald-700" : r.productivity >= 75 ? "text-amber-600" : "text-rose-600"}`}>{r.productivity}%</span></div>
              </div>
            </div>
          ))}
          {!isLoading && perItem.length > 0 && perItem.map((r) => (
            <div key={`sm-${r.name}`} className="hidden grid-cols-12 gap-2 border-b border-slate-50 px-4 py-2.5 text-sm last:border-0 sm:grid">
              <div className="col-span-6 min-w-0">
                <p className="truncate font-medium text-slate-800">{r.name}</p>
                <p className="text-[11px] text-slate-400">{r.unit || "-"}</p>
              </div>
              <div className="col-span-2 text-right text-slate-700">{Number(r.plan).toLocaleString("id-ID")}</div>
              <div className="col-span-2 text-right font-semibold text-emerald-700">{Number(r.actual).toLocaleString("id-ID")}</div>
              <div className={`col-span-2 text-right font-bold ${r.productivity >= 100 ? "text-emerald-700" : r.productivity >= 75 ? "text-amber-600" : "text-rose-600"}`}>{r.productivity}%</div>
            </div>
          ))}
        </div>
      </div>

      <ProductionActualListDialog open={showActual} onClose={() => setShowActual(false)} records={done} reqMap={reqMap} />
      <ProductionPlanListDialog open={showPlan} onClose={() => setShowPlan(false)} records={data} reqMap={reqMap} />
      <ProductionPlanListDialog open={showProcess} onClose={() => setShowProcess(false)} records={inProcess} reqMap={reqMap} title="Daftar Produksi Dalam Proses" />
      <ProductionRequestListDialog open={showRequests} onClose={() => setShowRequests(false)} requests={reqs} />
    </div>
  );
}
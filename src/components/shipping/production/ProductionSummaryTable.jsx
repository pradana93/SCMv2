import { useMemo, useState } from "react";
import { Search, ClipboardList, CheckCircle2, LoaderCircle, Clock } from "lucide-react";

const norm = (s) => (s || "").trim().toLowerCase();

export default function ProductionSummaryTable({ requests = [], productions = [], processes = [], onRowClick }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");

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

  const rows = useMemo(() => {
    return requests.map((r) => {
      const requested = Number(r.requested_quantity || 0);
      const planned = planSumByReq.get(r.id) || 0;
      const fulfilled = fulfilledByReq.get(r.id) || 0;
      const isComplete = requested > 0 && fulfilled >= requested;
      const status = isComplete ? "selesai" : planned > 0 ? "proses" : "menunggu";
      const progress = requested > 0 ? Math.min(100, Math.round((fulfilled / requested) * 100)) : 0;
      return { ...r, requested, planned, fulfilled, isComplete, status, progress };
    }).sort((a, b) => (b.request_date || "").localeCompare(a.request_date || ""));
  }, [requests, planSumByReq, fulfilledByReq]);

  const query = q.trim().toLowerCase();
  const filtered = rows.filter((r) => {
    if (filter === "proses" && r.status === "selesai") return false;
    if (filter === "selesai" && r.status !== "selesai") return false;
    if (!query) return true;
    return (r.item_name || "").toLowerCase().includes(query) || (r.warehouse || "").toLowerCase().includes(query);
  });

  const counts = useMemo(() => ({
    proses: rows.filter((r) => r.status !== "selesai").length,
    selesai: rows.filter((r) => r.status === "selesai").length,
    total: rows.length,
  }), [rows]);

  const statusBadge = (s) => {
    if (s === "selesai") return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700"><CheckCircle2 className="h-3 w-3" />Selesai</span>;
    if (s === "proses") return <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700"><LoaderCircle className="h-3 w-3" />Sedang Diproses</span>;
    return <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700"><Clock className="h-3 w-3" />Menunggu</span>;
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold text-slate-400">Total Permintaan</p>
          <p className="mt-1 text-2xl font-bold text-slate-800">{counts.total}</p>
        </div>
        <div className="rounded-2xl border border-blue-200 bg-blue-50/40 p-4 shadow-sm">
          <p className="text-xs font-semibold text-blue-400">Sedang Diproses</p>
          <p className="mt-1 text-2xl font-bold text-blue-700">{counts.proses}</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 shadow-sm">
          <p className="text-xs font-semibold text-emerald-400">Selesai</p>
          <p className="mt-1 text-2xl font-bold text-emerald-700">{counts.selesai}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
            {[
              { k: "all", l: "Semua" },
              { k: "proses", l: "Sedang Diproses" },
              { k: "selesai", l: "Selesai" },
            ].map((t) => (
              <button key={t.k} onClick={() => setFilter(t.k)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${filter === t.k ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}>{t.l}</button>
            ))}
          </div>
          <div className="relative sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari barang atau gudang..." className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-indigo-500" />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <ClipboardList className="h-8 w-8 text-slate-300" />
            <p className="mt-3 text-sm text-slate-500">Belum ada data permintaan.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-3">Barang</th>
                  <th className="px-4 py-3">Tanggal</th>
                  <th className="px-4 py-3">Gudang</th>
                  <th className="px-4 py-3 text-right">Diminta</th>
                  <th className="px-4 py-3 text-right">Direncanakan</th>
                  <th className="px-4 py-3 text-right">Masuk Stok</th>
                  <th className="px-4 py-3">Progres</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((r) => (
                  <tr key={r.id} onClick={() => onRowClick?.(r)} className={`transition hover:bg-slate-50/60 ${onRowClick ? "cursor-pointer" : ""}`}>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-800">{r.item_name}</p>
                      {r.note && <p className="truncate text-[11px] text-slate-400">{r.note}</p>}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{r.request_date || "-"}</td>
                    <td className="px-4 py-3 text-slate-500">{r.warehouse || "-"}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-700">{r.requested.toLocaleString("id-ID")} <span className="text-xs font-normal text-slate-400">{r.unit || ""}</span></td>
                    <td className="px-4 py-3 text-right text-slate-600">{r.planned.toLocaleString("id-ID")}</td>
                    <td className="px-4 py-3 text-right font-semibold text-emerald-600">{r.fulfilled.toLocaleString("id-ID")}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
                          <div className={`h-full rounded-full ${r.isComplete ? "bg-emerald-500" : "bg-indigo-500"}`} style={{ width: `${r.progress}%` }} />
                        </div>
                        <span className="text-[11px] text-slate-400">{r.progress}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">{statusBadge(r.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
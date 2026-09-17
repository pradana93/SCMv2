import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ScrollText, Search, Download } from "lucide-react";
import * as XLSX from "xlsx";
import { base44 } from "@/api/base44Client";
import { formatTimestamp } from "./shippingUtils";

const ACTION_META = {
  create: { label: "Create", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  update: { label: "Update", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  delete: { label: "Delete", cls: "bg-rose-50 text-rose-700 border-rose-200" },
  bulk_delete: { label: "Bulk Delete", cls: "bg-rose-50 text-rose-700 border-rose-200" },
  status_change: { label: "Status Change", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  reschedule: { label: "Reschedule", cls: "bg-violet-50 text-violet-700 border-violet-200" },
  set_accuracy: { label: "Set Accuracy", cls: "bg-cyan-50 text-cyan-700 border-cyan-200" },
  set_actual_arrival: { label: "Actual Arrival", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  verify: { label: "Verify", cls: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  login: { label: "Login", cls: "bg-slate-100 text-slate-600 border-slate-200" },
};

const todayStr = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

export default function AuditLogPanel() {
  const [from, setFrom] = useState(daysAgo(6));
  const [to, setTo] = useState(todayStr());
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");

  const { data = [], isLoading } = useQuery({
    queryKey: ["auditLogs", from, to],
    queryFn: async () => {
      const all = await base44.entities.AuditLog.list("-created_date", 500);
      return all.filter((l) => {
        const d = (l.created_date || "").slice(0, 10);
        return (!from || d >= from) && (!to || d <= to);
      });
    },
  });

  const filtered = useMemo(() => {
    let list = [...data];
    if (actionFilter !== "all") list = list.filter((l) => l.action === actionFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((l) =>
        String(l.user_name || "").toLowerCase().includes(q) ||
        String(l.entity_name || "").toLowerCase().includes(q) ||
        String(l.details || "").toLowerCase().includes(q) ||
        String(l.entity_type || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [data, actionFilter, search]);

  const actionTypes = useMemo(() => {
    const set = new Set(data.map((l) => l.action).filter(Boolean));
    return ["all", ...[...set].sort()];
  }, [data]);

  const download = () => {
    const header = ["Timestamp", "User", "Email", "Action", "Module", "Entity Type", "Entity Name", "Details"];
    const rows = filtered.map((l) => [formatTimestamp(l.created_date), l.user_name || "-", l.user_email || "-", ACTION_META[l.action]?.label || l.action || "-", l.module || "-", l.entity_type || "-", l.entity_name || "-", l.details || "-"]);
    const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
    ws["!cols"] = [{ wch: 20 }, { wch: 18 }, { wch: 24 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 20 }, { wch: 40 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Audit Log");
    XLSX.writeFile(wb, `audit-log-${from}_${to}.xlsx`);
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <div className="flex items-center gap-2">
          <ScrollText className="h-5 w-5 text-indigo-600" />
          <h2 className="text-base font-bold text-slate-800">Audit Log</h2>
        </div>
        <p className="mt-1 text-xs text-slate-500">Melacak semua perubahan data dan aktivitas penting pengguna di dalam sistem.</p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari user, entity, atau detail..." className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" />
          </div>
          <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-indigo-500">
            {actionTypes.map((a) => <option key={a} value={a}>{a === "all" ? "Semua Aksi" : (ACTION_META[a]?.label || a)}</option>)}
          </select>
          <label className="text-xs font-medium text-slate-500">Dari<input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="mt-1 block rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500" /></label>
          <label className="text-xs font-medium text-slate-500">Sampai<input type="date" value={to} min={from} max={todayStr()} onChange={(e) => setTo(e.target.value)} className="mt-1 block rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500" /></label>
          <button onClick={download} disabled={!filtered.length} className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"><Download className="h-4 w-4" />Export</button>
        </div>
      </div>

      <div className="px-5 py-3">
        <p className="text-sm text-slate-500">{filtered.length} log</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><div className="h-7 w-7 animate-spin rounded-full border-4 border-indigo-100 border-t-indigo-600" /></div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center"><ScrollText className="h-8 w-8 text-slate-300" /><p className="mt-3 text-sm text-slate-500">Tidak ada log pada rentang ini.</p></div>
      ) : (
        <div className="overflow-auto max-h-[60vh] border-t border-slate-100">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 shadow-sm">
              <tr>
                <th className="px-4 py-3">Waktu</th>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Aksi</th>
                <th className="px-4 py-3">Modul</th>
                <th className="px-4 py-3">Entity</th>
                <th className="px-4 py-3">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((l) => {
                const m = ACTION_META[l.action] || { label: l.action || "-", cls: "bg-slate-100 text-slate-600 border-slate-200" };
                return (
                  <tr key={l.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{formatTimestamp(l.created_date)}</td>
                    <td className="px-4 py-3"><p className="font-medium text-slate-700">{l.user_name || "-"}</p><p className="text-xs text-slate-400">{l.user_email || ""}</p></td>
                    <td className="px-4 py-3"><span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${m.cls}`}>{m.label}</span></td>
                    <td className="px-4 py-3 text-slate-600">{l.module || "-"}</td>
                    <td className="px-4 py-3"><p className="font-medium text-slate-700">{l.entity_name || "-"}</p><p className="text-xs text-slate-400">{l.entity_type || ""}</p></td>
                    <td className="px-4 py-3 text-slate-600">{l.details || "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
import { useMemo } from "react";
import { Users, Package, TrendingUp, Calendar } from "lucide-react";

export default function ProductionShiftSummary({ processes }) {
  const dailyData = useMemo(() => {
    const map = new Map();
    for (const p of (processes || [])) {
      const date = p.actual_date || p.plan_date || "-";
      if (!map.has(date)) map.set(date, { date, shifts: 0, actualQty: 0, crew: 0, rejectQty: 0, items: new Set() });
      const d = map.get(date);
      d.shifts += 1;
      d.actualQty += Number(p.actual_quantity || 0);
      d.crew += Number(p.crew_count || 0);
      d.rejectQty += Number(p.reject_quantity || 0);
      if (p.item_name) d.items.add(p.item_name);
    }
    const rows = Array.from(map.values()).map((d) => ({
      ...d,
      itemCount: d.items.size,
      productivity: d.crew > 0 ? Math.round((d.actualQty / d.crew) * 100) / 100 : 0,
      rejectRate: d.actualQty > 0 ? Math.round((d.rejectQty / (d.actualQty + d.rejectQty)) * 1000) / 10 : 0,
    }));
    rows.sort((a, b) => String(b.date).localeCompare(String(a.date)));
    return rows;
  }, [processes]);

  const totalShifts = dailyData.reduce((s, d) => s + d.shifts, 0);
  const totalActual = dailyData.reduce((s, d) => s + d.actualQty, 0);
  const totalCrew = dailyData.reduce((s, d) => s + d.crew, 0);
  const avgProductivity = totalCrew > 0 ? Math.round((totalActual / totalCrew) * 100) / 100 : 0;

  if (dailyData.length === 0) return null;

  return (
    <div className="mb-4 rounded-2xl border border-indigo-200 bg-indigo-50/30 p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-indigo-600" />
        <h3 className="text-sm font-bold text-slate-700">Ringkasan Produksi per Shift</h3>
        <span className="text-xs text-slate-400">· {totalShifts} shift · {totalActual.toLocaleString("id-ID")} qty · {totalCrew} kru · avg {avgProductivity}/kru</span>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
        {dailyData.slice(0, 14).map((d) => (
          <div key={d.date} className="min-w-[180px] shrink-0 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
              <Calendar className="h-3.5 w-3.5 text-slate-400" />
              {d.date}
            </div>
            <div className="mt-2 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1 text-slate-500"><Package className="h-3 w-3" />Shift</span>
                <span className="font-bold text-slate-800">{d.shifts}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1 text-slate-500"><Package className="h-3 w-3" />Aktual</span>
                <span className="font-bold text-emerald-600">{d.actualQty.toLocaleString("id-ID")}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1 text-slate-500"><Users className="h-3 w-3" />Kru</span>
                <span className="font-bold text-slate-800">{d.crew}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Produktivitas</span>
                <span className={`font-bold ${d.productivity >= 10 ? "text-emerald-600" : d.productivity >= 5 ? "text-amber-600" : "text-rose-600"}`}>{d.productivity}/kru</span>
              </div>
              {d.rejectQty > 0 && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Reject</span>
                  <span className="font-bold text-rose-500">{d.rejectQty.toLocaleString("id-ID")} ({d.rejectRate}%)</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
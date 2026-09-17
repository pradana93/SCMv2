import { CalendarDays, ArrowRight, CalendarCheck } from "lucide-react";
import { today } from "./shippingUtils";

export default function DateRangeBar({ dateFrom, dateTo, onFromChange, onToChange, hideToday = false }) {
  const handleFromChange = (val) => {
    onFromChange(val);
    if (dateTo < val) onToChange(val);
  };
  const handleToChange = (val) => {
    onToChange(val);
    if (dateFrom > val) onFromChange(val);
  };
  const goToday = () => { const t = today(); onFromChange(t); onToChange(t); };
  const active = dateFrom === today() && dateTo === today();
  return (
    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
      {!hideToday && <button type="button" onClick={goToday} className={`inline-flex w-full items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-semibold transition sm:w-auto ${active ? "border-indigo-600 bg-indigo-600 text-white shadow-sm" : "border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"}`}><CalendarCheck className="h-4 w-4" />Hari Ini</button>}
      <div className="flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm ring-1 ring-slate-100 sm:w-auto">
        <CalendarDays className="h-4 w-4 text-indigo-500 shrink-0" />
        <input type="date" value={dateFrom} onChange={(e) => handleFromChange(e.target.value)} className="min-w-0 flex-1 bg-transparent text-sm font-medium text-slate-700 outline-none sm:flex-none" />
        <ArrowRight className="h-3.5 w-3.5 text-slate-400 shrink-0" />
        <input type="date" value={dateTo} min={dateFrom} onChange={(e) => handleToChange(e.target.value)} className="min-w-0 flex-1 bg-transparent text-sm font-medium text-slate-700 outline-none sm:flex-none" />
      </div>
    </div>
  );
}
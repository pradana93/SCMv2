import { CalendarDays } from "lucide-react";

export default function DateBar({ date, onChange, max }) {
  return <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm ring-1 ring-slate-100">
    <CalendarDays className="h-4 w-4 text-indigo-500" />
    <input type="date" value={date} max={max} onChange={(e) => onChange(e.target.value)} className="bg-transparent text-sm font-medium text-slate-700 outline-none" />
  </label>;
}
import { useState, useEffect } from "react";
import { CalendarCheck } from "lucide-react";

export default function ActualArrivalInput({ value, onCommit, disabled }) {
  const [v, setV] = useState(value || "");
  useEffect(() => { setV(value || ""); }, [value]);
  return (
    <label className="inline-flex items-center gap-1.5">
      <CalendarCheck className="h-3.5 w-3.5 text-emerald-500" />
      <span className="text-xs text-slate-500">Aktual Tiba:</span>
      <input
        type="date"
        value={v}
        disabled={disabled}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => { if ((v || "") !== (value || "")) onCommit(v || null); }}
        className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none focus:border-indigo-400 disabled:opacity-50"
      />
    </label>
  );
}
import { useEffect, useState } from "react";

const pad = (n) => String(n).padStart(2, "0");

export default function ProcessTimer({ start, end, mode = "clock" }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (end || !start) return;
    const interval = mode === "minutes" ? 60000 : 1000;
    const t = setInterval(() => setNow(Date.now()), interval);
    return () => clearInterval(t);
  }, [end, start, mode]);

  if (!start) return <span className="text-slate-400">-</span>;
  const ref = end ? new Date(end).getTime() : now;
  const ms = Math.max(0, ref - new Date(start).getTime());
  if (mode === "minutes") {
    const hours = Math.floor(ms / 3600000);
    const min = Math.floor((ms % 3600000) / 60000);
    return end
      ? <span className="font-medium text-emerald-600">selesai {pad(hours)}:{pad(min)}</span>
      : <span className="font-medium text-blue-600">berjalan {pad(hours)}:{pad(min)}</span>;
  }
  if (mode === "hms") {
    const hours = Math.floor(ms / 3600000);
    const min = Math.floor((ms % 3600000) / 60000);
    const sec = Math.floor((ms % 60000) / 1000);
    return end
      ? <span className="font-medium text-emerald-600">selesai {pad(hours)}:{pad(min)}:{pad(sec)}</span>
      : <span className="font-medium text-blue-600">berjalan {pad(hours)}:{pad(min)}:{pad(sec)}</span>;
  }
  const min = Math.floor(ms / 60000);
  const sec = Math.round((ms % 60000) / 1000);
  return end
    ? <span className="font-medium text-emerald-600">selesai {pad(min)}:{pad(sec)}</span>
    : <span className="font-medium text-blue-600">berjalan {pad(min)}:{pad(sec)}</span>;
}
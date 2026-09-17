const ONLINE_MS = 5 * 60 * 1000;
const AWAY_MS = 15 * 60 * 1000;

export const presenceStatus = (lastActiveAt) => {
  if (!lastActiveAt) return { key: "offline", label: "Offline", dot: "bg-slate-300", text: "text-slate-500" };
  let diff;
  try { diff = Date.now() - new Date(lastActiveAt).getTime(); } catch { diff = Infinity; }
  if (diff < 0) diff = 0;
  if (diff < ONLINE_MS) return { key: "online", label: "Online", dot: "bg-emerald-500", text: "text-emerald-600" };
  if (diff < AWAY_MS) return { key: "away", label: "Away", dot: "bg-amber-400", text: "text-amber-600" };
  return { key: "offline", label: "Offline", dot: "bg-slate-300", text: "text-slate-500" };
};

export const formatLastOnline = (lastActiveAt) => {
  if (!lastActiveAt) return "Belum pernah online";
  try {
    return new Date(lastActiveAt).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch { return "-"; }
};
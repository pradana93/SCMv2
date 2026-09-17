import { useMemo } from "react";

const normKey = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const monthLabel = (ym) => {
  const [y, m] = ym.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
};

export default function SupplierMonthlySummary({ receipts, processes = [] }) {
  const rows = useMemo(() => {
    const procsByReceipt = new Map();
    for (const p of (processes || [])) {
      if (!p.receipt_id) continue;
      if (!procsByReceipt.has(p.receipt_id)) procsByReceipt.set(p.receipt_id, []);
      procsByReceipt.get(p.receipt_id).push(p);
    }
    const map = new Map();
    for (const r of (receipts || [])) {
      const sender = r.sender_name || "(Tanpa Nama)";
      const ym = (r.arrival_date || "").slice(0, 7);
      if (!ym) continue;
      const key = `${sender}||${ym}`;
      if (!map.has(key)) map.set(key, { sender, ym, plans: 0, totalItems: 0, onTime: 0, late: 0 });
      const rec = map.get(key);
      rec.plans += 1;
      const procs = procsByReceipt.get(r.id) || [];
      const receivedMap = new Map();
      let actualReceiveDate = null;
      for (const proc of procs) {
        for (const it of (proc.received_items || [])) {
          const k = normKey(it.item_name);
          const ex = receivedMap.get(k) || { quantity: 0 };
          ex.quantity += Number(it.quantity || 0);
          receivedMap.set(k, ex);
        }
        if (proc.receive_end_ts) {
          const d = new Date(proc.receive_end_ts).toISOString().slice(0, 10);
          if (!actualReceiveDate || d > actualReceiveDate) actualReceiveDate = d;
        }
      }
      for (const it of (r.items || [])) {
        const planned = Number(it.quantity || 0);
        const received = receivedMap.get(normKey(it.item_name))?.quantity || 0;
        rec.totalItems += 1;
        if (planned > 0 && received > 0 && actualReceiveDate && r.arrival_date) {
          if (actualReceiveDate <= r.arrival_date) rec.onTime += 1;
          else rec.late += 1;
        }
      }
    }
    const list = Array.from(map.values()).map((s) => ({
      ...s,
      onTimeRate: (s.onTime + s.late) > 0 ? Math.round((s.onTime / (s.onTime + s.late)) * 1000) / 10 : 100,
    }));
    list.sort((a, b) => a.sender.localeCompare(b.sender, "id") || a.ym.localeCompare(b.ym));
    return list;
  }, [receipts, processes]);

  const bySender = useMemo(() => {
    const map = new Map();
    for (const r of rows) {
      if (!map.has(r.sender)) map.set(r.sender, []);
      map.get(r.sender).push(r);
    }
    return Array.from(map.entries());
  }, [rows]);

  if (!rows.length) return null;

  return (
    <div className="mt-6">
      <h3 className="mb-3 text-base font-bold text-slate-800">Ringkasan Performa Bulanan</h3>
      <div className="space-y-4">
        {bySender.map(([sender, months]) => (
          <div key={sender} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="bg-slate-50 px-4 py-2.5 font-semibold text-slate-700">{sender}</div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-2.5">Bulan</th>
                    <th className="px-4 py-2.5 text-right">Total Rencana</th>
                    <th className="px-4 py-2.5 text-right">Total Item</th>
                    <th className="px-4 py-2.5 text-right">Tepat Waktu</th>
                    <th className="px-4 py-2.5 text-right">Terlambat</th>
                    <th className="px-4 py-2.5 text-right">On-Time Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {months.map((m) => (
                    <tr key={m.ym} className="hover:bg-slate-50/60">
                      <td className="px-4 py-2.5 font-medium text-slate-700">{monthLabel(m.ym)}</td>
                      <td className="px-4 py-2.5 text-right text-slate-600">{m.plans}</td>
                      <td className="px-4 py-2.5 text-right text-slate-600">{m.totalItems}</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-emerald-600">{m.onTime}</td>
                      <td className={`px-4 py-2.5 text-right font-semibold ${m.late > 0 ? "text-rose-600" : "text-slate-400"}`}>{m.late}</td>
                      <td className={`px-4 py-2.5 text-right font-bold ${m.onTimeRate >= 90 ? "text-emerald-600" : m.onTimeRate >= 75 ? "text-amber-600" : "text-rose-600"}`}>{m.onTimeRate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
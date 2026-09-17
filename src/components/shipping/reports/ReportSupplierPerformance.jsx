import { useMemo } from "react";
import { Download } from "lucide-react";
import * as XLSX from "xlsx";
import SupplierMonthlySummary from "./SupplierMonthlySummary";

const normKey = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const formatDate = (v) => { if (!v) return "-"; try { const d = new Date(v + "T00:00:00"); return isNaN(d.getTime()) ? v : d.toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" }); } catch { return v; } };

export default function ReportSupplierPerformance({ receipts, processes = [], verifications = [], dateFrom, dateTo }) {
  const procsByReceipt = useMemo(() => {
    const map = new Map();
    for (const p of (processes || [])) { if (!p.receipt_id) continue; if (!map.has(p.receipt_id)) map.set(p.receipt_id, []); map.get(p.receipt_id).push(p); }
    return map;
  }, [processes]);

  const rows = useMemo(() => {
    const supplierMap = new Map();
    for (const r of (receipts || [])) {
      const sender = r.sender_name || "(Tanpa Nama)";
      if (!supplierMap.has(sender)) supplierMap.set(sender, { sender, plans: 0, itemsPlanned: 0, itemsReceived: 0, onTime: 0, late: 0, qtyDiscrepancy: 0, dateDiscrepancy: 0, totalItems: 0 });
      const sup = supplierMap.get(sender);
      sup.plans += 1;
      const procs = procsByReceipt.get(r.id) || [];
      const receivedMap = new Map();
      let actualReceiveDate = null;
      for (const proc of procs) {
        for (const it of (proc.received_items || [])) {
          const k = normKey(it.item_name);
          const ex = receivedMap.get(k) || { quantity: 0, unit: it.unit || "" };
          ex.quantity += Number(it.quantity || 0);
          receivedMap.set(k, ex);
        }
        if (proc.receive_end_ts) {
          const d = new Date(proc.receive_end_ts).toISOString().slice(0, 10);
          if (!actualReceiveDate || d > actualReceiveDate) actualReceiveDate = d;
        }
      }
      for (const it of (r.items || [])) {
        const k = normKey(it.item_name);
        const planned = Number(it.quantity || 0);
        const received = receivedMap.get(k)?.quantity || 0;
        sup.totalItems += 1;
        sup.itemsPlanned += planned;
        sup.itemsReceived += received;
        if (received < planned) sup.qtyDiscrepancy += 1;
        if (planned > 0 && received > 0) {
          if (actualReceiveDate && r.arrival_date) {
            if (actualReceiveDate <= r.arrival_date) sup.onTime += 1;
            else { sup.late += 1; sup.dateDiscrepancy += 1; }
          }
        }
      }
    }
    const list = Array.from(supplierMap.values()).map((s) => ({
      ...s,
      qtyAccuracy: s.totalItems > 0 ? Math.round(((s.totalItems - s.qtyDiscrepancy) / s.totalItems) * 1000) / 10 : 100,
      onTimeRate: (s.onTime + s.late) > 0 ? Math.round((s.onTime / (s.onTime + s.late)) * 1000) / 10 : 100,
      avgDiscrepancy: s.totalItems > 0 ? Math.round((s.qtyDiscrepancy / s.totalItems) * 1000) / 10 : 0,
    }));
    list.sort((a, b) => a.qtyAccuracy - b.qtyAccuracy || a.onTimeRate - b.onTimeRate);
    return list;
  }, [receipts, procsByReceipt]);

  const download = () => {
    const header = ["Supplier", "Jml Rencana", "Total Item", "Item Sesuai Qty", "Item Kurang Qty", "Akurasi Qty (%)", "Tepat Waktu", "Terlambat", "On-Time Rate (%)", "Item Tidak Sesuai Tgl"];
    const data = rows.map((r) => [r.sender, r.plans, r.totalItems, r.totalItems - r.qtyDiscrepancy, r.qtyDiscrepancy, r.qtyAccuracy, r.onTime, r.late, r.onTimeRate, r.dateDiscrepancy]);
    const summary = [[`Laporan Supplier Performance`], [`Periode: ${formatDate(dateFrom)} - ${formatDate(dateTo)}`], [`Total Supplier: ${rows.length}`], [], []];
    const ws = XLSX.utils.aoa_to_sheet([...summary, header, ...data]);
    ws["!cols"] = [{ wch: 22 }, { wch: 12 }, { wch: 12 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 12 }, { wch: 16 }, { wch: 18 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Supplier Performance");
    XLSX.writeFile(wb, "laporan-supplier-performance.xlsx");
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-slate-500">{rows.length} supplier · {rows.filter((r) => r.qtyAccuracy < 100).length} ada discrepancy qty · {rows.filter((r) => r.onTimeRate < 100).length} terlambat</p>
        <button onClick={download} disabled={!rows.length} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"><Download className="h-4 w-4" />Download</button>
      </div>
      {rows.length === 0 ? <p className="text-sm text-slate-400">Tidak ada data supplier pada rentang ini.</p> :
        <div className="overflow-auto max-h-[60vh] rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 shadow-sm">
              <tr>
                <th className="px-4 py-3">Supplier</th>
                <th className="px-4 py-3 text-right">Rencana</th>
                <th className="px-4 py-3 text-right">Total Item</th>
                <th className="px-4 py-3 text-right">Sesuai Qty</th>
                <th className="px-4 py-3 text-right">Kurang Qty</th>
                <th className="px-4 py-3 text-right">Akurasi Qty</th>
                <th className="px-4 py-3 text-right">Tepat Waktu</th>
                <th className="px-4 py-3 text-right">Terlambat</th>
                <th className="px-4 py-3 text-right">On-Time Rate</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => {
                const isGood = r.qtyAccuracy >= 95 && r.onTimeRate >= 90;
                const isWarning = r.qtyAccuracy >= 80 && r.onTimeRate >= 75;
                const status = isGood ? { label: "Baik", cls: "bg-emerald-50 text-emerald-700" } : isWarning ? { label: "Perlu Perhatian", cls: "bg-amber-50 text-amber-700" } : { label: "Buruk", cls: "bg-rose-50 text-rose-700" };
                return (
                  <tr key={r.sender} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3 font-medium text-slate-700">{r.sender}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{r.plans}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{r.totalItems}</td>
                    <td className="px-4 py-3 text-right text-emerald-600 font-semibold">{r.totalItems - r.qtyDiscrepancy}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${r.qtyDiscrepancy > 0 ? "text-rose-600" : "text-slate-400"}`}>{r.qtyDiscrepancy}</td>
                    <td className={`px-4 py-3 text-right font-bold ${r.qtyAccuracy >= 95 ? "text-emerald-600" : r.qtyAccuracy >= 80 ? "text-amber-600" : "text-rose-600"}`}>{r.qtyAccuracy}%</td>
                    <td className="px-4 py-3 text-right text-emerald-600 font-semibold">{r.onTime}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${r.late > 0 ? "text-rose-600" : "text-slate-400"}`}>{r.late}</td>
                    <td className={`px-4 py-3 text-right font-bold ${r.onTimeRate >= 90 ? "text-emerald-600" : r.onTimeRate >= 75 ? "text-amber-600" : "text-rose-600"}`}>{r.onTimeRate}%</td>
                    <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${status.cls}`}>{status.label}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>}
      <SupplierMonthlySummary receipts={receipts} processes={processes} />
    </div>
  );
}
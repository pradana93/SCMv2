import { useMemo } from "react";
import { Download } from "lucide-react";
import * as XLSX from "xlsx";

const normKey = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const formatDate = (v) => { if (!v) return "-"; try { const d = new Date(v); return isNaN(d.getTime()) ? v : d.toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" }); } catch { return v; } };
const formatTime = (v) => { if (!v) return "-"; try { return new Date(v).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }); } catch { return v; } };

export default function ReportPenerimaan({ receipts, processes = [], dateFrom, dateTo }) {
  const procsByReceipt = useMemo(() => {
    const map = new Map();
    for (const p of (processes || [])) { if (!p.receipt_id) continue; if (!map.has(p.receipt_id)) map.set(p.receipt_id, []); map.get(p.receipt_id).push(p); }
    return map;
  }, [processes]);

  const rows = useMemo(() => {
    const list = [];
    for (const r of (receipts || [])) {
      const procs = procsByReceipt.get(r.id) || [];
      const accumMap = new Map();
      for (const proc of procs) {
        for (const it of (proc.received_items || [])) {
          const k = normKey(it.item_name);
          const ex = accumMap.get(k) || { quantity: 0, tonnage: 0, unit: it.unit || "" };
          ex.quantity += Number(it.quantity || 0);
          ex.tonnage += Number(it.tonnage || 0);
          accumMap.set(k, ex);
        }
      }
      const skNames = [...new Set(procs.map((p) => p.stock_keeper_name).filter(Boolean))];
      const receiveTimes = procs.map((p) => p.receive_start_ts).filter(Boolean).sort();
      const receiveTime = receiveTimes[0] || null;
      const items = Array.isArray(r.items) ? r.items : [];
      for (const it of items) {
        const k = normKey(it.item_name);
        const planned = Number(it.quantity || 0);
        const received = accumMap.get(k)?.quantity || 0;
        const remaining = Math.max(0, planned - received);
        list.push({
          sender: r.sender_name || "-",
          arrival_date: r.arrival_date || "-",
          receive_time: receiveTime,
          sk_name: skNames.join(", ") || "-",
          warehouse: r.warehouse || "-",
          item_name: it.item_name || "-",
          unit: it.unit || "",
          planned, received, remaining,
          is_complete: remaining === 0 && received > 0,
          rounds: procs.length,
        });
      }
    }
    return list;
  }, [receipts, procsByReceipt]);

  const totalPlanned = rows.reduce((s, r) => s + r.planned, 0);
  const totalReceived = rows.reduce((s, r) => s + r.received, 0);
  const totalRemaining = rows.reduce((s, r) => s + r.remaining, 0);
  const completeCount = rows.filter((r) => r.is_complete).length;
  const partialCount = rows.filter((r) => !r.is_complete && r.received > 0).length;
  const pendingCount = rows.filter((r) => r.received === 0).length;

  const download = () => {
    const header = ["Pengirim", "Tgl Kedatangan", "Jam Penerimaan", "Nama SK", "Gudang", "Barang", "Satuan", "Rencana", "Diterima", "Sisa", "Status", "Jml Proses"];
    const data = rows.map((r) => [r.sender, formatDate(r.arrival_date), formatTime(r.receive_time), r.sk_name, r.warehouse, r.item_name, r.unit, r.planned, r.received, r.remaining, r.is_complete ? "Lengkap" : r.received > 0 ? "Parsial" : "Pending", r.rounds]);
    const summary = [
      [`Rekap Penerimaan Barang`],
      [`Periode: ${formatDate(dateFrom)} - ${formatDate(dateTo)}`],
      [`Total Rencana: ${totalPlanned} · Total Diterima: ${totalReceived} · Total Sisa: ${totalRemaining}`],
      [`Lengkap: ${completeCount} item · Parsial: ${partialCount} item · Belum Diterima: ${pendingCount} item`],
      [],
    ];
    const ws = XLSX.utils.aoa_to_sheet([...summary, header, ...data]);
    ws["!cols"] = [{ wch: 18 }, { wch: 14 }, { wch: 12 }, { wch: 18 }, { wch: 16 }, { wch: 20 }, { wch: 8 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 16 }, { wch: 10 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Rekap Penerimaan");
    XLSX.writeFile(wb, "rekap-penerimaan-barang.xlsx");
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-slate-500">{rows.length} item · Rencana {totalPlanned} · Diterima {totalReceived} · Sisa {totalRemaining}</p>
        <button onClick={download} disabled={!rows.length} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"><Download className="h-4 w-4" />Download</button>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
          <p className="text-xs font-medium text-slate-500">Penerimaan Lengkap</p>
          <p className="mt-1 text-xl font-bold text-emerald-600">{completeCount} item</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
          <p className="text-xs font-medium text-slate-500">Penerimaan Parsial</p>
          <p className="mt-1 text-xl font-bold text-amber-600">{partialCount} item</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Belum Diterima</p>
          <p className="mt-1 text-xl font-bold text-slate-600">{pendingCount} item</p>
        </div>
      </div>

      {rows.length === 0 ? <p className="text-sm text-slate-400">Tidak ada data penerimaan pada rentang ini.</p> :
        <div className="overflow-auto max-h-[60vh] rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 shadow-sm">
              <tr>
                <th className="px-4 py-3">Pengirim</th>
                <th className="px-4 py-3">Tgl Kedatangan</th>
                <th className="px-4 py-3">Jam Penerimaan</th>
                <th className="px-4 py-3">Nama SK</th>
                <th className="px-4 py-3">Gudang</th>
                <th className="px-4 py-3">Barang</th>
                <th className="px-4 py-3 text-right">Rencana</th>
                <th className="px-4 py-3 text-right">Diterima</th>
                <th className="px-4 py-3 text-right">Sisa</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-center">Proses</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r, i) => (
                <tr key={i} className="hover:bg-slate-50/60">
                  <td className="px-4 py-3 font-medium text-slate-700">{r.sender}</td>
                  <td className="px-4 py-3 text-slate-600">{formatDate(r.arrival_date)}</td>
                  <td className="px-4 py-3 text-slate-600">{formatTime(r.receive_time)}</td>
                  <td className="px-4 py-3 text-slate-600">{r.sk_name}</td>
                  <td className="px-4 py-3 text-slate-600">{r.warehouse}</td>
                  <td className="px-4 py-3 text-slate-700">{r.item_name} <span className="text-xs text-slate-400">{r.unit}</span></td>
                  <td className="px-4 py-3 text-right text-slate-600">{Number(r.planned).toLocaleString("id-ID")}</td>
                  <td className="px-4 py-3 text-right font-semibold text-emerald-600">{Number(r.received).toLocaleString("id-ID")}</td>
                  <td className={`px-4 py-3 text-right font-semibold ${r.remaining > 0 ? "text-rose-600" : "text-slate-400"}`}>{Number(r.remaining).toLocaleString("id-ID")}</td>
                  <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${r.is_complete ? "bg-emerald-50 text-emerald-700" : r.received > 0 ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-500"}`}>{r.is_complete ? "Lengkap" : r.received > 0 ? "Parsial" : "Pending"}</span></td>
                  <td className="px-4 py-3 text-center text-slate-500">{r.rounds > 0 ? `${r.rounds}×` : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>}
    </div>
  );
}
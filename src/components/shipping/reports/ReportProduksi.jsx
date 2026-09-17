import { useMemo } from "react";
import { Download } from "lucide-react";
import * as XLSX from "xlsx";
import { formatTimestamp, formatDuration } from "@/components/shipping/shippingUtils";

export default function ReportProduksi({ productions, processes = [], requests = [], dateFrom, dateTo }) {
  const reqMap = useMemo(() => new Map((requests || []).map((r) => [r.id, r])), [requests]);

  const procsByPlan = useMemo(() => {
    const map = new Map();
    for (const p of (processes || [])) { if (!p.plan_id) continue; if (!map.has(p.plan_id)) map.set(p.plan_id, []); map.get(p.plan_id).push(p); }
    return map;
  }, [processes]);

  const enriched = useMemo(() => (productions || [])
    .filter((p) => (!dateFrom || (p.plan_date || "") >= dateFrom) && (!dateTo || (p.plan_date || "") <= dateTo))
    .sort((a, b) => String(b.plan_date || "").localeCompare(String(a.plan_date || "")))
    .map((p) => {
      const procs = procsByPlan.get(p.id) || [];
      const doneProcs = procs.filter((pr) => pr.status === "selesai");
      const actualQty = doneProcs.reduce((s, pr) => s + (Number(pr.actual_quantity) || 0), 0);
      const rejectQty = doneProcs.reduce((s, pr) => s + (Number(pr.reject_quantity) || 0), 0);
      const crewCount = procs.reduce((s, pr) => s + (Number(pr.crew_count) || 0), 0);
      const starts = procs.map((pr) => pr.timestamp_start).filter(Boolean).sort();
      const ends = doneProcs.map((pr) => pr.timestamp_end).filter(Boolean).sort();
      const startTs = starts[0] || null;
      const endTs = ends[ends.length - 1] || null;
      const isDone = actualQty >= Number(p.planned_quantity || 0) && Number(p.planned_quantity || 0) > 0;
      const status = isDone ? "selesai" : procs.some((pr) => pr.status === "dalam_proses" || pr.status === "menunggu_verifikasi" || pr.status === "dalam_pembekuan") ? "dalam_proses" : "menunggu_proses";
      return { ...p, actual_quantity: actualQty, reject_quantity: rejectQty, crew_count: crewCount, timestamp_start: startTs, timestamp_end: endTs, status, process_count: procs.length };
    }), [productions, procsByPlan, dateFrom, dateTo]);

  const totalPlan = enriched.reduce((s, p) => s + Number(p.planned_quantity || 0), 0);
  const done = enriched.filter((p) => p.status === "selesai");
  const totalActual = done.reduce((s, p) => s + Number(p.actual_quantity || 0), 0);
  const totalCrew = done.reduce((s, p) => s + Number(p.crew_count || 0), 0);
  const avgProd = totalCrew > 0 ? Math.round((totalActual / totalCrew) * 100) / 100 : 0;
  const achievement = totalPlan > 0 ? Math.round((totalActual / totalPlan) * 1000) / 10 : 0;

  const dailyCrew = useMemo(() => {
    const map = new Map();
    for (const p of done) {
      const d = p.actual_date || p.plan_date || "-";
      const cur = map.get(d) || { date: d, actual: 0, crew: 0, tasks: 0 };
      cur.actual += Number(p.actual_quantity || 0);
      cur.crew += Number(p.crew_count || 0);
      cur.tasks += 1;
      map.set(d, cur);
    }
    const rows = [...map.values()].map((r) => ({ ...r, productivity: r.crew > 0 ? Math.round((r.actual / r.crew) * 100) / 100 : 0 }));
    rows.sort((a, b) => String(b.date).localeCompare(String(a.date)));
    return rows;
  }, [done]);

  const notes = (p) => {
    const parts = [];
    const req = p.request_id ? reqMap.get(p.request_id) : null;
    if (req) parts.push(`Permintaan ${req.request_date || "-"}`);
    if (p.note) parts.push(p.note);
    return parts.join(" · ");
  };

  const download = () => {
    const header = ["Tgl Permintaan", "Tgl Rencana", "Barang", "Satuan", "Rencana Qty", "Jml Proses", "Crew", "Mulai Proses", "Selesai Proses", "Durasi", "Aktual Qty", "Reject", "Selisih", "% Pencapaian", "Produktivitas/Crew", "Catatan"];
    const data = enriched.map((p) => {
      const req = p.request_id ? reqMap.get(p.request_id) : null;
      const selisih = p.status === "selesai" ? Number(p.planned_quantity || 0) - Number(p.actual_quantity || 0) : null;
      const pct = p.status === "selesai" && Number(p.planned_quantity || 0) > 0 ? Math.round((Number(p.actual_quantity || 0) / Number(p.planned_quantity)) * 1000) / 10 : null;
      const prod = p.status === "selesai" && Number(p.crew_count || 0) > 0 ? Math.round((Number(p.actual_quantity || 0) / Number(p.crew_count)) * 100) / 100 : null;
      return [
        req?.request_date || "-", p.plan_date || "-", p.item_name || "-", p.unit || "-",
        Number(p.planned_quantity || 0), p.process_count || 0, Number(p.crew_count || 0),
        p.timestamp_start ? formatTimestamp(p.timestamp_start) : "-", p.timestamp_end ? formatTimestamp(p.timestamp_end) : "-",
        p.timestamp_start ? formatDuration(p.timestamp_start, p.timestamp_end) : "-",
        p.status === "selesai" ? Number(p.actual_quantity || 0) : "-", p.status === "selesai" ? Number(p.reject_quantity || 0) : "-",
        selisih, pct, prod, notes(p) || "-",
      ];
    });
    const summary = [[`Total Rencana: ${totalPlan}`], [`Total Aktual: ${totalActual}`], [`Total Crew (selesai): ${totalCrew}`], [`Pencapaian: ${achievement}%`], [`Rata-rata Produktivitas/Crew: ${avgProd}`], [`Dibuat: ${new Date().toLocaleString("id-ID")}`], []];
    const ws = XLSX.utils.aoa_to_sheet([["Laporan Produksi"], [], ...summary, header, ...data]);
    ws["!cols"] = [{ wch: 14 }, { wch: 14 }, { wch: 22 }, { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 8 }, { wch: 20 }, { wch: 20 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 16 }, { wch: 30 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Laporan Produksi");
    if (dailyCrew.length > 0) {
      const crewHeader = ["Tanggal", "Jumlah Tugas", "Total Output", "Total Kru", "Output/Kru"];
      const crewData = dailyCrew.map((d) => [d.date, d.tasks, Number(d.actual), d.crew, d.productivity]);
      const crewWs = XLSX.utils.aoa_to_sheet([["Ringkasan Produktivitas Harian per Kru"], [], crewHeader, ...crewData]);
      crewWs["!cols"] = [{ wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 14 }];
      XLSX.utils.book_append_sheet(wb, crewWs, "Produktivitas Harian");
    }
    XLSX.writeFile(wb, "laporan-produksi.xlsx");
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-slate-500">{enriched.length} rencana · {done.length} selesai · Pencapaian {achievement}% · Produktivitas/Crew {avgProd}</p>
        <button onClick={download} disabled={!enriched.length} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"><Download className="h-4 w-4" />Download</button>
      </div>

      {dailyCrew.length > 0 && (
        <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="mb-2 text-sm font-bold text-slate-700">Ringkasan Produktivitas Harian per Kru</p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">Tanggal</th>
                  <th className="px-3 py-2 text-right">Jumlah Tugas</th>
                  <th className="px-3 py-2 text-right">Total Output</th>
                  <th className="px-3 py-2 text-right">Total Kru</th>
                  <th className="px-3 py-2 text-right">Output/Kru</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dailyCrew.map((d) => (
                  <tr key={d.date} className="hover:bg-slate-50/60">
                    <td className="px-3 py-2 font-medium text-slate-700">{d.date}</td>
                    <td className="px-3 py-2 text-right text-slate-600">{d.tasks}</td>
                    <td className="px-3 py-2 text-right font-semibold text-slate-800">{Number(d.actual).toLocaleString("id-ID")}</td>
                    <td className="px-3 py-2 text-right text-slate-600">{d.crew}</td>
                    <td className="px-3 py-2 text-right font-semibold text-violet-700">{d.productivity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {enriched.length === 0 ? <p className="text-sm text-slate-400">Tidak ada data produksi sesuai filter ini.</p> :
        <div className="overflow-auto max-h-[60vh] rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 shadow-sm">
              <tr>
                <th className="px-3 py-3">Tgl Permintaan</th>
                <th className="px-3 py-3">Tgl Rencana</th>
                <th className="px-3 py-3">Barang</th>
                <th className="px-3 py-3 text-right">Rencana</th>
                <th className="px-3 py-3 text-center">Proses</th>
                <th className="px-3 py-3 text-right">Crew</th>
                <th className="px-3 py-3">Mulai Proses</th>
                <th className="px-3 py-3">Selesai Proses</th>
                <th className="px-3 py-3 text-right">Durasi</th>
                <th className="px-3 py-3 text-right">Aktual</th>
                <th className="px-3 py-3 text-right">Selisih</th>
                <th className="px-3 py-3 text-right">% Pencapaian</th>
                <th className="px-3 py-3 text-right">Produktivitas/Crew</th>
                <th className="px-3 py-3">Catatan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {enriched.map((p) => {
                const req = p.request_id ? reqMap.get(p.request_id) : null;
                const selisih = p.status === "selesai" ? Number(p.planned_quantity || 0) - Number(p.actual_quantity || 0) : null;
                const pct = p.status === "selesai" && Number(p.planned_quantity || 0) > 0 ? Math.round((Number(p.actual_quantity || 0) / Number(p.planned_quantity)) * 1000) / 10 : null;
                const prod = p.status === "selesai" && Number(p.crew_count || 0) > 0 ? Math.round((Number(p.actual_quantity || 0) / Number(p.crew_count)) * 100) / 100 : null;
                return (
                  <tr key={p.id} className="hover:bg-slate-50/60">
                    <td className="px-3 py-3 text-slate-600">{req?.request_date || "-"}</td>
                    <td className="px-3 py-3 text-slate-600">{p.plan_date || "-"}</td>
                    <td className="px-3 py-3 font-medium text-slate-700">{p.item_name || "-"}</td>
                    <td className="px-3 py-3 text-right">{Number(p.planned_quantity || 0).toLocaleString("id-ID")} <span className="text-xs text-slate-400">{p.unit || ""}</span></td>
                    <td className="px-3 py-3 text-center text-slate-600">{p.process_count || 0}</td>
                    <td className="px-3 py-3 text-right text-slate-600">{p.crew_count || 0}</td>
                    <td className="px-3 py-3 text-slate-600 whitespace-nowrap">{p.timestamp_start ? formatTimestamp(p.timestamp_start) : "-"}</td>
                    <td className="px-3 py-3 text-slate-600 whitespace-nowrap">{p.timestamp_end ? formatTimestamp(p.timestamp_end) : "-"}</td>
                    <td className="px-3 py-3 text-right text-slate-600 whitespace-nowrap">{p.timestamp_start ? formatDuration(p.timestamp_start, p.timestamp_end) : "-"}</td>
                    <td className="px-3 py-3 text-right">{p.status === "selesai" ? `${Number(p.actual_quantity || 0).toLocaleString("id-ID")}` : "-"} <span className="text-xs text-slate-400">{p.unit || ""}</span></td>
                    <td className={`px-3 py-3 text-right font-semibold ${selisih == null ? "text-slate-400" : selisih >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{selisih == null ? "-" : Number(selisih).toLocaleString("id-ID")}</td>
                    <td className="px-3 py-3 text-right text-indigo-700 font-semibold">{pct == null ? "-" : `${pct}%`}</td>
                    <td className="px-3 py-3 text-right text-violet-700 font-semibold">{prod == null ? "-" : prod}</td>
                    <td className="px-3 py-3 text-slate-500">{notes(p) || "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>}
    </div>
  );
}
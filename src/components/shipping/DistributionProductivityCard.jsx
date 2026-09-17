import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Boxes } from "lucide-react";
import { base44 } from "@/api/base44Client";
import DateRangeBar from "@/components/shipping/DateRangeBar";
import WarehouseMultiSelect from "@/components/shipping/WarehouseMultiSelect";
import ShipmentListDialog from "@/components/shipping/ShipmentListDialog";

const fmtInt = (v) => Number(v || 0).toLocaleString("id-ID");
const fmtDec = (v) => (Number(v || 0)).toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export default function DistributionProductivityCard() {
  const today = todayStr();
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [warehouses, setWarehouses] = useState([]);
  const [detail, setDetail] = useState(null);

  const wf = warehouses.length === 0 ? {} : { warehouse: { $in: warehouses } };
  const { data = [], isLoading } = useQuery({
    queryKey: ["shipments", "productivity", from, to, warehouses],
    queryFn: () => base44.entities.Shipment.filter({ delivery_date: { $gte: from, $lte: to }, ...wf }, "-delivery_date"),
  });

  const rows = useMemo(() => {
    const map = {};
    for (const s of data) {
      const d = s.delivery_date || "";
      if (!d) continue;
      if (!map[d]) map[d] = { date: d, doCount: 0, tonnage: 0, pickCrew: 0, packCrew: 0, loadCrew: 0, shipments: [] };
      const r = map[d];
      r.doCount += 1;
      r.tonnage += Number(s.tonnage || 0);
      r.pickCrew += Number(s.picking_crew_count || 0);
      r.packCrew += Number(s.packing_crew_count || 0);
      r.loadCrew += Number(s.loading_crew_count || 0);
      r.shipments.push(s);
    }
    return Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
  }, [data]);

  const totals = useMemo(() => rows.reduce((acc, r) => {
    acc.doCount += r.doCount;
    acc.tonnage += r.tonnage;
    acc.pickCrew += r.pickCrew;
    acc.packCrew += r.packCrew;
    acc.loadCrew += r.loadCrew;
    return acc;
  }, { doCount: 0, tonnage: 0, pickCrew: 0, packCrew: 0, loadCrew: 0 }), [rows]);

  return (
    <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3">
        <h3 className="text-base font-bold text-slate-800">Distribution Productivity Review</h3>
        <p className="text-xs text-slate-500">Rata-rata tonase per crew per tanggal pengiriman.</p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4">
        <WarehouseMultiSelect value={warehouses} onChange={setWarehouses} className="w-full sm:w-[200px]" />
        <DateRangeBar dateFrom={from} dateTo={to} onFromChange={setFrom} onToChange={setTo} hideToday />
      </div>
      <div className="md:hidden space-y-2">
        {isLoading ? (
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-center text-sm text-slate-400">Memuat data…</div>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-center text-sm text-slate-400">Tidak ada data pada rentang ini.</div>
        ) : (
          <>
          {rows.map((r) => (
            <div key={r.date} onClick={() => setDetail({ date: r.date, shipments: r.shipments })} className="cursor-pointer rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition hover:bg-indigo-50/60">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-800">{r.date}</span>
                <span className="text-xs text-slate-500">{fmtInt(r.doCount)} DO</span>
              </div>
              <div className="mt-1.5 grid grid-cols-2 gap-1 text-xs">
                <div><span className="text-slate-400">Tonase: </span><span className="font-semibold text-slate-700">{fmtInt(r.tonnage)}</span></div>
                <div><span className="text-slate-400">Picking: </span><span className="font-semibold text-slate-700">{r.pickCrew > 0 ? fmtDec(r.tonnage / r.pickCrew) : "-"}</span></div>
                <div><span className="text-slate-400">Packing: </span><span className="font-semibold text-slate-700">{r.packCrew > 0 ? fmtDec(r.tonnage / r.packCrew) : "-"}</span></div>
                <div><span className="text-slate-400">Loading: </span><span className="font-semibold text-slate-700">{r.loadCrew > 0 ? fmtDec(r.tonnage / r.loadCrew) : "-"}</span></div>
              </div>
            </div>
          ))}
          <div className="rounded-xl bg-slate-100 p-3 text-xs font-semibold">
            <div className="flex items-center justify-between">
              <span className="text-slate-800">Total</span>
              <span className="text-slate-700">{fmtInt(totals.doCount)} DO · {fmtInt(totals.tonnage)} kg</span>
            </div>
            <div className="mt-1 grid grid-cols-3 gap-1 text-slate-600">
              <span>P: {totals.pickCrew > 0 ? fmtDec(totals.tonnage / totals.pickCrew) : "-"}</span>
              <span>K: {totals.packCrew > 0 ? fmtDec(totals.tonnage / totals.packCrew) : "-"}</span>
              <span>L: {totals.loadCrew > 0 ? fmtDec(totals.tonnage / totals.loadCrew) : "-"}</span>
            </div>
          </div>
          </>
        )}
      </div>
      <div className="hidden md:block overflow-x-auto -mx-4 px-4">
        <table className="w-full border-collapse text-sm min-w-[680px]">
          <thead>
            <tr className="bg-slate-100">
              <th className="border border-slate-300 px-2 py-2 text-left font-semibold text-slate-700">Date</th>
              <th className="border border-slate-300 px-2 py-2 text-right font-semibold text-slate-700">Total DO</th>
              <th className="border border-slate-300 px-2 py-2 text-right font-semibold text-slate-700">Total Tonase</th>
              <th className="border border-slate-300 px-2 py-2 text-right font-semibold text-slate-700">Avg Tonase / Crew Picking</th>
              <th className="border border-slate-300 px-2 py-2 text-right font-semibold text-slate-700">Avg Tonase / Crew Packing</th>
              <th className="border border-slate-300 px-2 py-2 text-right font-semibold text-slate-700">Avg Tonase / Crew Loading</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} className="border border-slate-300 px-2 py-6 text-center text-slate-400">Memuat data…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={6} className="border border-slate-300 px-2 py-6 text-center text-slate-400">Tidak ada data pada rentang ini.</td></tr>
            ) : (
              rows.map((r) => (
                <tr key={r.date} onClick={() => setDetail({ date: r.date, shipments: r.shipments })} className="cursor-pointer hover:bg-indigo-50/60">
                  <td className="border border-slate-300 px-2 py-2 text-slate-700">{r.date}</td>
                  <td className="border border-slate-300 px-2 py-2 text-right text-slate-700">{fmtInt(r.doCount)}</td>
                  <td className="border border-slate-300 px-2 py-2 text-right text-slate-700">{fmtInt(r.tonnage)}</td>
                  <td className="border border-slate-300 px-2 py-2 text-right text-slate-700">{r.pickCrew > 0 ? fmtDec(r.tonnage / r.pickCrew) : "-"}</td>
                  <td className="border border-slate-300 px-2 py-2 text-right text-slate-700">{r.packCrew > 0 ? fmtDec(r.tonnage / r.packCrew) : "-"}</td>
                  <td className="border border-slate-300 px-2 py-2 text-right text-slate-700">{r.loadCrew > 0 ? fmtDec(r.tonnage / r.loadCrew) : "-"}</td>
                </tr>
              ))
            )}
          </tbody>
          {!isLoading && rows.length > 0 && (
            <tfoot>
              <tr className="bg-slate-100 font-semibold">
                <td className="border border-slate-300 px-2 py-2 text-slate-800">Total</td>
                <td className="border border-slate-300 px-2 py-2 text-right text-slate-800">{fmtInt(totals.doCount)}</td>
                <td className="border border-slate-300 px-2 py-2 text-right text-slate-800">{fmtInt(totals.tonnage)}</td>
                <td className="border border-slate-300 px-2 py-2 text-right text-slate-800">{totals.pickCrew > 0 ? fmtDec(totals.tonnage / totals.pickCrew) : "-"}</td>
                <td className="border border-slate-300 px-2 py-2 text-right text-slate-800">{totals.packCrew > 0 ? fmtDec(totals.tonnage / totals.packCrew) : "-"}</td>
                <td className="border border-slate-300 px-2 py-2 text-right text-slate-800">{totals.loadCrew > 0 ? fmtDec(totals.tonnage / totals.loadCrew) : "-"}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <ShipmentListDialog open={!!detail} onClose={() => setDetail(null)} title={`DO ${detail?.date || ""}`} icon={Boxes} shipments={detail?.shipments || []} />
    </div>
  );
}
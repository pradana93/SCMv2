import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Factory, Users, Package } from "lucide-react";
import { base44 } from "@/api/base44Client";
import WarehouseMultiSelect from "@/components/shipping/WarehouseMultiSelect";
import { useUserWarehouses } from "@/components/shipping/useUserWarehouses";

export default function ProductionInProgressCard() {
  const { userWarehouses, hasAll } = useUserWarehouses();
  const [wh, setWh] = useState(hasAll ? [] : userWarehouses);
  useEffect(() => { if (!hasAll && userWarehouses.length) setWh(userWarehouses); }, [hasAll, userWarehouses]);
  const isAllWh = !wh || wh.length === 0;

  const { data: processes = [], isLoading } = useQuery({
    queryKey: ["productionProcesses", "inProgress", wh],
    queryFn: async () => {
      const all = await base44.entities.ProductionProcess.list("-created_date", 500);
      return all.filter((p) => p.status === "dalam_proses" && (isAllWh || wh.includes(p.warehouse)));
    },
  });

  const summary = useMemo(() => {
    const map = new Map();
    let totalQty = 0;
    let totalCrew = 0;
    for (const p of processes) {
      const name = p.item_name || "(Tanpa nama)";
      const ex = map.get(name) || { name, unit: p.unit || "", qty: 0, crew: 0, count: 0 };
      ex.qty += Number(p.round_quantity || 0);
      ex.crew += Number(p.crew_count || 0);
      ex.count += 1;
      map.set(name, ex);
      totalQty += Number(p.round_quantity || 0);
      totalCrew += Number(p.crew_count || 0);
    }
    return { perItem: [...map.values()].sort((a, b) => b.qty - a.qty), totalQty, totalCrew, count: processes.length };
  }, [processes]);

  return (
    <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50/40 p-5 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Factory className="h-5 w-5 text-blue-600" />
          <div>
            <h2 className="text-sm font-bold text-slate-700">Stok Dalam Proses Produksi</h2>
            <p className="text-xs text-slate-400">Beban kerja tim produksi hari ini</p>
          </div>
        </div>
        <WarehouseMultiSelect value={wh} onChange={setWh} className="w-full sm:w-[200px]" />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-blue-200 bg-white p-4">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-blue-600" />
            <p className="text-xs font-medium text-slate-500">Total Item Diproduksi</p>
          </div>
          <p className="mt-1 text-xl font-bold text-blue-600">{isLoading ? "—" : summary.count}</p>
          <p className="mt-0.5 text-xs text-slate-400">{isLoading ? "" : `${summary.perItem.length} jenis barang`}</p>
        </div>
        <div className="rounded-xl border border-blue-200 bg-white p-4">
          <div className="flex items-center gap-2">
            <Factory className="h-4 w-4 text-blue-600" />
            <p className="text-xs font-medium text-slate-500">Total Kuantitas</p>
          </div>
          <p className="mt-1 text-xl font-bold text-blue-600">{isLoading ? "—" : Number(summary.totalQty).toLocaleString("id-ID")}</p>
          <p className="mt-0.5 text-xs text-slate-400">{isLoading ? "" : "kg dalam proses"}</p>
        </div>
        <div className="rounded-xl border border-blue-200 bg-white p-4">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-blue-600" />
            <p className="text-xs font-medium text-slate-500">Total Crew</p>
          </div>
          <p className="mt-1 text-xl font-bold text-blue-600">{isLoading ? "—" : summary.totalCrew}</p>
          <p className="mt-0.5 text-xs text-slate-400">{isLoading ? "" : "orang bekerja"}</p>
        </div>
      </div>

      {isLoading ? (
        <div className="mt-4 py-6 text-center text-sm text-slate-400">Memuat data...</div>
      ) : summary.perItem.length === 0 ? (
        <div className="mt-4 py-6 text-center text-sm text-slate-400">Tidak ada produksi dalam proses saat ini.</div>
      ) : (
        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="hidden grid-cols-12 gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 sm:grid">
            <div className="col-span-6">Barang</div>
            <div className="col-span-2 text-right">Proses</div>
            <div className="col-span-2 text-right">Kuantitas</div>
            <div className="col-span-2 text-right">Crew</div>
          </div>
          <div className="max-h-48 overflow-auto">
            {summary.perItem.map((r) => (
              <div key={`m-${r.name}`} className="border-b border-slate-50 px-4 py-2.5 last:border-0 sm:hidden">
                <p className="truncate text-sm font-medium text-slate-800">{r.name}</p>
                <p className="text-[11px] text-slate-400">{r.unit || "-"}</p>
                <div className="mt-1 grid grid-cols-3 gap-2 text-xs">
                  <div><span className="text-slate-400">Proses </span><span className="text-slate-700">{r.count}×</span></div>
                  <div><span className="text-slate-400">Qty </span><span className="font-semibold text-blue-600">{Number(r.qty).toLocaleString("id-ID")}</span></div>
                  <div className="text-right"><span className="text-slate-400">Crew </span><span className="font-semibold text-slate-700">{r.crew}</span></div>
                </div>
              </div>
            ))}
            {summary.perItem.map((r) => (
              <div key={`sm-${r.name}`} className="hidden grid-cols-12 gap-2 border-b border-slate-50 px-4 py-2.5 text-sm last:border-0 sm:grid">
                <div className="col-span-6 min-w-0">
                  <p className="truncate font-medium text-slate-800">{r.name}</p>
                  <p className="text-[11px] text-slate-400">{r.unit || "-"}</p>
                </div>
                <div className="col-span-2 text-right text-slate-600">{r.count}×</div>
                <div className="col-span-2 text-right font-semibold text-blue-600">{Number(r.qty).toLocaleString("id-ID")}</div>
                <div className="col-span-2 text-right text-slate-700">{r.crew}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
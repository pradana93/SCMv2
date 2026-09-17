import { useMemo, useState } from "react";
import { Package } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import WarehouseMultiSelect from "./WarehouseMultiSelect";
import { useStockCurrent } from "./useStockCurrent";

const COLORS = ["#6366f1", "#10b981", "#f59e0b", "#f43f5e", "#06b6d4", "#8b5cf6", "#ec4899", "#14b8a6", "#a855f7", "#eab308", "#64748b", "#22c55e"];

export default function StockSummaryCard({ warehouses = [], setWarehouses }) {
  const { items, currentFor } = useStockCurrent();
  const [asOfDate, setAsOfDate] = useState(() => new Date().toISOString().slice(0, 10));

  const { chartData, total } = useMemo(() => {
    const map = {};
    let totalStock = 0;
    for (const it of items) {
      const cat = (it.category || "").trim() || "Tanpa Kategori";
      const stock = currentFor(it.name, warehouses, asOfDate);
      if (stock <= 0) continue;
      if (!map[cat]) map[cat] = { name: cat, value: 0, itemCount: 0 };
      map[cat].value += stock;
      map[cat].itemCount += 1;
      totalStock += stock;
    }
    const arr = Object.values(map).sort((a, b) => b.value - a.value);
    return { chartData: arr, total: totalStock };
  }, [items, currentFor, warehouses, asOfDate]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Ringkasan Stok per Kategori</h2>
          <p className="text-sm text-slate-500">Persentase stok berdasarkan kategori ke total stok tersedia{warehouses.length === 1 ? ` — ${warehouses[0]}` : warehouses.length > 1 ? ` — ${warehouses.length} gudang` : ""}.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="block text-xs font-medium text-slate-500">Per Tanggal<input type="date" value={asOfDate} onChange={(e) => setAsOfDate(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-indigo-500 sm:w-[160px]" /></label>
          <WarehouseMultiSelect value={warehouses} onChange={setWarehouses} className="w-full sm:w-[200px]" />
        </div>
      </div>

      {total === 0 ? (
        <div className="mt-6 flex flex-col items-center justify-center py-10 text-center">
          <Package className="h-8 w-8 text-slate-300" />
          <p className="mt-3 text-sm text-slate-500">Belum ada stok tersedia{warehouses.length === 1 ? ` di ${warehouses[0]}` : warehouses.length > 1 ? ` di ${warehouses.length} gudang terpilih` : ""} per {asOfDate}.</p>
        </div>
      ) : (
        <>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={45} paddingAngle={2}>
                    {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => `${Number(v).toLocaleString("id-ID")} unit`} contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2">
              {chartData.map((c, i) => {
                const pct = total > 0 ? (c.value / total) * 100 : 0;
                return (
                  <div key={c.name} className="rounded-xl border border-slate-200 p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                        <span className="truncate text-sm font-medium text-slate-700">{c.name}</span>
                      </div>
                      <span className="text-sm font-bold text-slate-900">{pct.toFixed(1)}%</span>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between text-xs text-slate-500">
                      <span>{c.itemCount} barang</span>
                      <span>{Number(c.value).toLocaleString("id-ID")} unit</span>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: COLORS[i % COLORS.length] }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="mt-4 rounded-xl bg-slate-50 p-3 text-center">
            <p className="text-xs text-slate-500">Total Stok Tersedia per {asOfDate}</p>
            <p className="mt-0.5 text-xl font-bold text-slate-900">{Number(total).toLocaleString("id-ID")} unit</p>
          </div>
        </>
      )}
    </div>
  );
}
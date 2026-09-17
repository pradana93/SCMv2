import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, ChevronDown, X, Boxes } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { ALL_WAREHOUSES } from "./shippingUtils";
import { Checkbox } from "@/components/ui/checkbox";

const norm = (s) => (s || "").trim().toLowerCase();

export default function StockAnalysis({ rows, movements, shipments, wh, asOfDate }) {
  const { data: users = [] } = useQuery({ queryKey: ["users"], queryFn: () => base44.entities.User.list() });
  const userMap = useMemo(() => { const m = new Map(); for (const u of users) m.set(u.id, u.full_name || u.email || "-"); return m; }, [users]);

  const allNames = useMemo(() => rows.map((r) => r.name).filter(Boolean).sort((a, b) => a.localeCompare(b, "id")), [rows]);
  const [selected, setSelected] = useState(() => new Set(allNames));
  const key = allNames.join("||");
  useEffect(() => { setSelected(new Set(allNames)); }, [key]);
  const [itemSearch, setItemSearch] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);

  const filteredNames = useMemo(() => allNames.filter((n) => !itemSearch.trim() || n.toLowerCase().includes(itemSearch.trim().toLowerCase())), [allNames, itemSearch]);
  const allSelected = selected.size === allNames.length && allNames.length > 0;
  const toggle = (n) => setSelected((p) => { const s = new Set(p); s.has(n) ? s.delete(n) : s.add(n); return s; });
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(allNames));
  const clearAll = () => setSelected(new Set());

  const detailFor = useMemo(() => {
    return (name) => {
      const k = norm(name);
      const list = [];
      for (const m of movements || []) {
        if (norm(m.item_name) !== k) continue;
        if (!(wh === ALL_WAREHOUSES || !m.warehouse || m.warehouse === wh)) continue;
        const mDate = m.date || (m.created_date || "").slice(0, 10);
        if (asOfDate && mDate > asOfDate) continue;
        list.push({ date: mDate, type: m.type, qty: Number(m.quantity || 0), note: m.note || "", warehouse: m.warehouse || "Semua", by: userMap.get(m.created_by_id) || "-", ts: m.created_date });
      }
      for (const s of shipments || []) {
        if (s.status !== "sudah_dikirim") continue;
        if (!(wh === ALL_WAREHOUSES || s.warehouse === wh)) continue;
        if (asOfDate && (s.delivery_date || "") > asOfDate) continue;
        for (const it of (Array.isArray(s.do_items) ? s.do_items : [])) {
          if (norm(it.name) !== k) continue;
          list.push({ date: s.delivery_date || "", type: "keluar", qty: Number(it.quantity || 0), note: `${s.outlet_name || "-"} · ${s.do_number || ""}`, warehouse: s.warehouse || "-", by: "-", ts: s.updated_date || "" });
        }
      }
      list.sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")) || String(b.ts || "").localeCompare(String(a.ts || "")));
      return list;
    };
  }, [movements, shipments, wh, userMap, asOfDate]);

  const visible = rows.filter((r) => selected.has(r.name));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="relative">
          <button onClick={() => setPickerOpen((v) => !v)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50">
            <Checkbox checked={allSelected} onCheckedChange={toggleAll} className="pointer-events-none" />
            <span>Pilih Barang ({selected.size}/{allNames.length})</span>
            <ChevronDown className={`h-4 w-4 text-slate-400 transition ${pickerOpen ? "rotate-180" : ""}`} />
          </button>
          {pickerOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setPickerOpen(false)} />
              <div className="absolute left-0 z-20 mt-2 w-72 rounded-2xl border border-slate-200 bg-white p-3 shadow-lg">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input value={itemSearch} onChange={(e) => setItemSearch(e.target.value)} placeholder="Cari barang..." className="w-full rounded-lg border border-slate-200 py-2 pl-8 pr-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" autoFocus />
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-600"><Checkbox checked={allSelected} onCheckedChange={toggleAll} />Pilih Semua</label>
                  <button onClick={clearAll} className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 hover:text-rose-700"><X className="h-3.5 w-3.5" />Kosongkan</button>
                </div>
                <div className="mt-2 max-h-64 space-y-0.5 overflow-y-auto">
                  {filteredNames.length === 0 ? <p className="py-4 text-center text-xs text-slate-400">Tidak ada barang cocok.</p> :
                    filteredNames.map((n) => (
                      <label key={n} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50">
                        <Checkbox checked={selected.has(n)} onCheckedChange={() => toggle(n)} />
                        <span className="truncate">{n}</span>
                      </label>
                    ))}
                </div>
              </div>
            </>
          )}
        </div>
        {selected.size === 0 && <p className="text-xs font-medium text-amber-600">Tidak ada barang dipilih — pilih barang untuk menampilkan analisis.</p>}
      </div>

      {visible.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center"><Boxes className="h-8 w-8 text-slate-300" /><p className="mt-3 text-sm text-slate-500">{selected.size === 0 ? "Pilih minimal satu barang." : "Belum ada data stok untuk barang ini."}</p></div>
      ) : (
        <div className="space-y-4">
          {visible.map((r) => {
            const detail = detailFor(r.name);
            return (
              <div key={r.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-800">{r.name}</p>
                    <p className="text-xs text-slate-400">{r.code || "tanpa kode"} · {r.category || "-"}</p>
                  </div>
                  <p className="text-2xl font-bold tracking-tight text-slate-900">{Number(r.current).toLocaleString("id-ID")} <span className="text-sm font-medium text-slate-400">{r.unit || ""}</span></p>
                </div>
                <div className="mt-2 flex items-center gap-3 text-xs">
                  <span className="text-emerald-600">+{Number(r.masuk).toLocaleString("id-ID")} masuk</span>
                  <span className="text-rose-500">-{Number(r.keluar).toLocaleString("id-ID")} keluar</span>
                  <span className="ml-auto text-slate-400">min {Number(r.min_stock || 0).toLocaleString("id-ID")}</span>
                </div>
                <div className="mt-3 border-t border-slate-100 pt-2">
                  <p className="mb-1 text-xs font-semibold text-slate-500">Rincian pergerakan ({detail.length})</p>
                  {detail.length === 0 ? <p className="text-xs text-slate-400">Belum ada pergerakan.</p> :
                    <div className="max-h-60 overflow-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="sticky top-0 bg-white text-[11px] uppercase tracking-wide text-slate-400">
                          <tr>
                            <th className="px-2 py-1.5">Tanggal</th>
                            <th className="px-2 py-1.5">Gudang</th>
                            <th className="px-2 py-1.5">Tipe</th>
                            <th className="px-2 py-1.5 text-right">Jumlah</th>
                            <th className="px-2 py-1.5">Keterangan</th>
                            <th className="px-2 py-1.5">Oleh</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {detail.map((d, i) => (
                            <tr key={i} className="hover:bg-slate-50/60">
                              <td className="px-2 py-1.5 text-slate-600">{d.date || "-"}</td>
                              <td className="px-2 py-1.5 text-slate-600">{d.warehouse}</td>
                              <td className="px-2 py-1.5"><span className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${d.type === "masuk" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-600"}`}>{d.type === "masuk" ? "Masuk" : "Keluar"}</span></td>
                              <td className="px-2 py-1.5 text-right font-semibold">{d.type === "masuk" ? "+" : "-"}{Number(d.qty).toLocaleString("id-ID")}</td>
                              <td className="px-2 py-1.5 text-slate-500">{d.note || "-"}</td>
                              <td className="px-2 py-1.5 text-slate-500">{d.by}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
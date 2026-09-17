import { useMemo, useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { ALL_WAREHOUSES, formatTimestamp } from "./shippingUtils";
import { convertToBase, getBaseUnit } from "./unitConversion";

const norm = (s) => (s || "").trim().toLowerCase();
const formatDate = (v) => { if (!v) return "-"; try { const d = new Date(v.length <= 10 ? v + "T00:00:00" : v); return isNaN(d.getTime()) ? v : d.toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" }); } catch { return v; } };

export default function StockMovementDialog({ open, onClose, itemName, warehouse = ALL_WAREHOUSES, asOfDate }) {
  const { data: movements = [] } = useQuery({ queryKey: ["stockMovements"], queryFn: () => base44.entities.StockMovement.list("-created_date", 500), enabled: open });
  const { data: shipments = [] } = useQuery({ queryKey: ["shipments", "stock"], queryFn: () => base44.entities.Shipment.list("-delivery_date", 500), enabled: open });
  const { data: users = [] } = useQuery({ queryKey: ["users"], queryFn: () => base44.entities.User.list(), enabled: open });
  const { data: items = [] } = useQuery({ queryKey: ["stockItems"], queryFn: () => base44.entities.StockItem.list(), enabled: open });
  const userMap = useMemo(() => { const m = new Map(); for (const u of users) m.set(u.id, u.full_name || u.email || "-"); return m; }, [users]);
  const item = useMemo(() => items.find((i) => norm(i.name) === norm(itemName)), [items, itemName]);
  const baseUnit = getBaseUnit(item) || item?.unit || "";

  const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  useEffect(() => { if (open) { setToDate(asOfDate || new Date().toISOString().slice(0, 10)); setFromDate(daysAgo(7)); } }, [open, asOfDate]);

  const detail = useMemo(() => {
    const k = norm(itemName);
    if (!k) return [];
    const whArr = Array.isArray(warehouse) ? warehouse : null;
    const isAll = whArr ? whArr.length === 0 : warehouse === ALL_WAREHOUSES;
    const matchWh = (w) => isAll || !w || (whArr ? whArr.includes(w) : w === warehouse);
    const list = [];
    for (const m of movements) {
      if (norm(m.item_name) !== k) continue;
      if (!matchWh(m.warehouse)) continue;
      const mDate = m.date || (m.created_date || "").slice(0, 10);
      if (fromDate && mDate < fromDate) continue;
      if (toDate && mDate > toDate) continue;
      const isTransfer = m.reference === "transfer";
      const isImport = m.reference === "import";
      list.push({ date: mDate, type: isTransfer ? "transfer" : m.type, qty: Number(m.quantity || 0), qtyBase: convertToBase(item, m.quantity, m.unit), unit: m.unit || "", note: m.note || "", warehouse: m.warehouse || "Semua", by: isImport ? `Import by ${userMap.get(m.created_by_id) || "-"}` : (userMap.get(m.created_by_id) || "-"), ts: m.created_date, id: m.id });
    }
    for (const s of shipments) {
      if (s.status !== "sudah_dikirim") continue;
      if (!matchWh(s.warehouse)) continue;
      if (fromDate && (s.delivery_date || "") < fromDate) continue;
      if (toDate && (s.delivery_date || "") > toDate) continue;
      for (const it of (Array.isArray(s.do_items) ? s.do_items : [])) {
        if (norm(it.name) !== k) continue;
        list.push({ date: s.delivery_date || "", type: "keluar", qty: Number(it.quantity || 0), qtyBase: convertToBase(item, it.quantity, it.unit), unit: it.unit || "", note: `${s.outlet_name || "-"} · ${s.do_number || ""}`, warehouse: s.warehouse || "-", by: "-", ts: s.updated_date || "", id: `s-${s.id}` });
      }
    }
    list.sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")) || String(b.ts || "").localeCompare(String(a.ts || "")));
    return list;
  }, [movements, shipments, itemName, warehouse, userMap, fromDate, toDate, item]);

  const totalIn = detail.filter((d) => d.type === "masuk").reduce((s, d) => s + d.qtyBase, 0);
  const totalOut = detail.filter((d) => d.type === "keluar").reduce((s, d) => s + d.qtyBase, 0);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Riwayat Pergerakan: {itemName}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs font-medium text-slate-600">Dari<input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="mt-1 block rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" /></label>
          <label className="text-xs font-medium text-slate-600">Sampai<input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="mt-1 block rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" /></label>
          {(fromDate || toDate) && <button onClick={() => { setFromDate(""); setToDate(""); }} className="text-xs font-medium text-slate-500 underline hover:text-slate-700">Reset</button>}
        </div>
        <div className="mb-2 flex flex-wrap items-center gap-4 text-xs">
          <span className="font-semibold text-emerald-600">Total masuk: +{Number(totalIn).toLocaleString("id-ID")} {baseUnit}</span>
          <span className="font-semibold text-rose-600">Total keluar: -{Number(totalOut).toLocaleString("id-ID")} {baseUnit}</span>
          <span className="font-semibold text-slate-500">Saldo: {Number(totalIn - totalOut).toLocaleString("id-ID")} {baseUnit}</span>
        </div>
        {detail.length === 0 ? <p className="py-8 text-center text-sm text-slate-400">Belum ada pergerakan untuk barang ini pada rentang tanggal ini.</p> :
          <div className="max-h-[50vh] overflow-auto rounded-xl border border-slate-100">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-2.5 py-2">Tanggal</th>
                  <th className="px-2.5 py-2">Gudang</th>
                  <th className="px-2.5 py-2">Tipe</th>
                  <th className="px-2.5 py-2 text-right">Jumlah</th>
                  <th className="px-2.5 py-2">Keterangan</th>
                  <th className="px-2.5 py-2">Oleh</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {detail.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50/60">
                    <td className="px-2.5 py-2 text-slate-600 whitespace-nowrap"><div>{formatDate(d.date)}</div>{d.ts && <div className="text-[10px] text-slate-400">{formatTimestamp(d.ts)}</div>}</td>
                    <td className="px-2.5 py-2 text-slate-600">{d.warehouse}</td>
                    <td className="px-2.5 py-2">
                      <span className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${d.type === "masuk" ? "bg-emerald-50 text-emerald-700" : d.type === "transfer" ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-600"}`}>
                        {d.type === "masuk" ? "Masuk" : d.type === "transfer" ? "Transfer" : "Keluar"}
                      </span>
                    </td>
                    <td className="px-2.5 py-2 text-right font-semibold">{d.type === "masuk" ? "+" : "-"}{Number(d.qty).toLocaleString("id-ID")} <span className="text-[10px] font-normal text-slate-400">{d.unit || baseUnit}</span></td>
                    <td className="px-2.5 py-2 text-slate-500">{d.note || "-"}</td>
                    <td className="px-2.5 py-2 text-slate-500">{d.by}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>}
      </DialogContent>
    </Dialog>
  );
}
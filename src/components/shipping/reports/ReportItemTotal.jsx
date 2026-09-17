import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import * as XLSX from "xlsx";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { statusMeta } from "../shippingUtils";
import { convertToBase, getBaseUnit } from "../unitConversion";
import DoDetailDialog from "../DoDetailDialog";

const normKey = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

export default function ReportItemTotal({ shipments, status, dateFrom, dateTo }) {
  const [selected, setSelected] = useState(null);
  const [doItem, setDoItem] = useState(null);
  const filtered = status === "all" ? shipments : shipments.filter((s) => s.status === status);
  const { data: stockItems = [] } = useQuery({ queryKey: ["stockItems"], queryFn: () => base44.entities.StockItem.list() });
  const itemMap = useMemo(() => {
    const m = new Map();
    for (const it of stockItems) {
      m.set(normKey(it.name), it);
      if (it.code) m.set(normKey(it.code), it);
    }
    return m;
  }, [stockItems]);
  const rows = useMemo(() => {
    const map = new Map();
    for (const s of filtered) {
      const seen = new Set();
      for (const it of (Array.isArray(s.do_items) ? s.do_items : [])) {
        const nm = (it?.name || "").trim() || "(tanpa nama)";
        const si = itemMap.get(normKey(nm)) || (it?.code ? itemMap.get(normKey(it.code)) : null);
        const e = map.get(nm) || { name: nm, qty: 0, unit: getBaseUnit(si) || it?.unit || "", count: 0, warehouses: new Set() };
        e.qty += convertToBase(si, Number(it?.quantity || 0), it?.unit);
        if (s.warehouse) e.warehouses.add(s.warehouse);
        if (!seen.has(nm)) { e.count += 1; seen.add(nm); }
        map.set(nm, e);
      }
    }
    return [...map.values()].map((r) => ({ ...r, warehouse: [...r.warehouses].sort((a, b) => a.localeCompare(b, "id")).join(", ") || "-" })).sort((a, b) => b.qty - a.qty);
  }, [filtered, itemMap]);

  const statusLabel = status === "all" ? "Semua Status" : (statusMeta[status]?.label || status);

  const download = () => {
    const titleRows = [
      ["Laporan Total Kuantitas per Barang"],
      [`Periode: ${dateFrom || "-"} s/d ${dateTo || "-"}`],
      [`Status Pengiriman: ${statusLabel}`],
      [],
    ];
    const header = ["Nama Barang", "Satuan", "Total Kuantitas", "Jumlah Pengiriman"];
    const data = rows.map((r) => [r.name, r.unit || "-", Number(r.qty), r.count]);
    const ws = XLSX.utils.aoa_to_sheet([...titleRows, header, ...data]);
    ws["!cols"] = [{ wch: 30 }, { wch: 14 }, { wch: 16 }, { wch: 16 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Total Kuantitas");
    XLSX.writeFile(wb, "report-total-kuantitas.xlsx", { bookType: "xlsx" });
  };

  const selectedUnit = useMemo(() => {
    if (!selected) return "";
    const si = itemMap.get(normKey(selected));
    return getBaseUnit(si) || "";
  }, [selected, itemMap]);

  const selectedDos = useMemo(() => {
    if (!selected) return [];
    const si = itemMap.get(normKey(selected));
    return filtered
      .map((s) => ({ s, qty: (Array.isArray(s.do_items) ? s.do_items : []).filter((it) => normKey((it?.name || "").trim() || "(tanpa nama)") === normKey(selected)).reduce((sum, it) => sum + convertToBase(si, Number(it?.quantity || 0), it?.unit), 0) }))
      .filter((x) => x.qty > 0);
  }, [selected, filtered, itemMap]);

  return <div>
    <div className="mb-3 flex items-center justify-between">
      <p className="text-sm text-slate-500">{rows.length} jenis barang · {filtered.length} pengiriman</p>
      <button onClick={download} disabled={!rows.length} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"><Download className="h-4 w-4" />Download</button>
    </div>
    {rows.length === 0 ? <p className="text-sm text-slate-400">Tidak ada data sesuai filter ini.</p> :
      <div className="space-y-2 max-h-[28rem] overflow-y-auto">
        {rows.map((r, i) => (
          <button key={i} onClick={() => setSelected(r.name)} className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-2.5 text-left transition hover:border-indigo-300 hover:bg-indigo-50/40">
            <div className="min-w-0"><p className="truncate text-sm font-medium">{r.name}</p><p className="text-xs text-slate-400">Satuan: {r.unit || "-"} · {r.count} pengiriman · Gudang: {r.warehouse}</p></div>
            <span className="shrink-0 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">{Number(r.qty).toLocaleString("id-ID")} {r.unit || ""}</span>
          </button>
        ))}
      </div>}
    <Dialog open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>DO dengan barang: {selected}</DialogTitle></DialogHeader>
        <div className="max-h-[60vh] space-y-2 overflow-y-auto">
          {selectedDos.length === 0 ? <p className="text-sm text-slate-400">Tidak ada DO.</p> : selectedDos.map(({ s, qty }) => (
            <div key={s.id} className="rounded-xl border border-slate-200 p-3">
              <div className="flex items-center justify-between gap-2">
                <button onClick={() => setDoItem(s)} className="truncate text-left text-sm font-semibold text-indigo-600 transition hover:underline" title="Lihat detail DO">{s.outlet_name}</button>
                <span className="shrink-0 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">{Number(qty).toLocaleString("id-ID")} {selectedUnit}</span>
              </div>
              <p className="mt-1 text-xs text-slate-500">DO: {s.do_number || "-"} · {s.delivery_date} · {s.warehouse}</p>
              <p className="mt-0.5 text-xs text-slate-400">Checker: {s.checker_name || "-"} · Status: {(statusMeta[s.status] || statusMeta.menunggu_antrian).label}</p>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
    <DoDetailDialog item={doItem} onClose={() => setDoItem(null)} />
  </div>;
}
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import * as XLSX from "xlsx";
import { base44 } from "@/api/base44Client";
import { convertToBase, getBaseUnit } from "../unitConversion";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const norm = (s) => (s || "").trim().toLowerCase();

export default function ReportStock({ shipments, warehouses = [], dateFrom, dateTo }) {
  const [detailItem, setDetailItem] = useState(null);
  const { data: items = [], isLoading } = useQuery({ queryKey: ["stockItems"], queryFn: () => base44.entities.StockItem.list() });
  const { data: movements = [] } = useQuery({ queryKey: ["stockMovements"], queryFn: () => base44.entities.StockMovement.list("-created_date", 2000) });
  const { data: allShipments = [] } = useQuery({ queryKey: ["shipments", "stockReport", "all"], queryFn: () => base44.entities.Shipment.list("-delivery_date", 2000) });

  const isAll = !warehouses || warehouses.length === 0;
  const whOk = (mwh) => isAll || !mwh || warehouses.includes(mwh);
  const whLabel = isAll ? "Semua Gudang" : warehouses.length === 1 ? warehouses[0] : `${warehouses.length} Gudang`;

  const { rows, masukDetails, keluarDetails } = useMemo(() => {
    const itemMap = new Map();
    for (const it of items) itemMap.set(norm(it.name), it);

    const masukDetailsMap = new Map();
    const keluarDetailsMap = new Map();
    const masukBefore = new Map();
    const keluarBefore = new Map();
    const masukTotal = new Map();
    const keluarTotal = new Map();

    const addMasuk = (itemName, date, qty, unit, note, warehouse, reference) => {
      const k = norm(itemName);
      if (!k || !date) return;
      if (dateFrom && date < dateFrom) {
        masukBefore.set(k, (masukBefore.get(k) || 0) + qty);
      } else if ((!dateFrom || date >= dateFrom) && (!dateTo || date <= dateTo)) {
        masukTotal.set(k, (masukTotal.get(k) || 0) + qty);
        if (!masukDetailsMap.has(k)) masukDetailsMap.set(k, []);
        masukDetailsMap.get(k).push({ date, qty, unit, note, warehouse, reference });
      }
    };

    const addKeluar = (itemName, date, qty, unit, note, warehouse, reference) => {
      const k = norm(itemName);
      if (!k || !date) return;
      if (dateFrom && date < dateFrom) {
        keluarBefore.set(k, (keluarBefore.get(k) || 0) + qty);
      } else if ((!dateFrom || date >= dateFrom) && (!dateTo || date <= dateTo)) {
        keluarTotal.set(k, (keluarTotal.get(k) || 0) + qty);
        if (!keluarDetailsMap.has(k)) keluarDetailsMap.set(k, []);
        keluarDetailsMap.get(k).push({ date, qty, unit, note, warehouse, reference });
      }
    };

    for (const m of movements) {
      if (!whOk(m.warehouse)) continue;
      const mDate = m.date || (m.created_date || "").slice(0, 10);
      const item = itemMap.get(norm(m.item_name));
      const qty = convertToBase(item, m.quantity, m.unit);
      if (m.type === "masuk") addMasuk(m.item_name, mDate, qty, m.unit, m.note, m.warehouse, m.reference || "manual");
      else if (m.type === "keluar") addKeluar(m.item_name, mDate, qty, m.unit, m.note, m.warehouse, m.reference || "manual");
    }

    for (const s of allShipments) {
      if (s.status !== "sudah_dikirim") continue;
      if (!isAll && !warehouses.includes(s.warehouse)) continue;
      const sDate = s.delivery_date || "";
      for (const it of (Array.isArray(s.do_items) ? s.do_items : [])) {
        const item = itemMap.get(norm(it.name));
        const qty = convertToBase(item, it.quantity, it.unit);
        addKeluar(it.name, sDate, qty, it.unit, `DO: ${s.do_number || "-"}`, s.warehouse, "pengiriman");
      }
    }

    const reportRows = items
      .map((it) => {
        const k = norm(it.name);
        const stockAwal = (masukBefore.get(k) || 0) - (keluarBefore.get(k) || 0);
        const totalMasuk = masukTotal.get(k) || 0;
        const totalKeluar = keluarTotal.get(k) || 0;
        const sisa = stockAwal + totalMasuk - totalKeluar;
        return {
          id: it.id,
          code: it.code || "-",
          name: it.name,
          unit: getBaseUnit(it) || it.unit || "",
          stockAwal,
          totalMasuk,
          totalKeluar,
          sisa,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, "id"));

    return { rows: reportRows, masukDetails: masukDetailsMap, keluarDetails: keluarDetailsMap };
  }, [items, movements, allShipments, warehouses, dateFrom, dateTo]);

  const download = () => {
    const header = ["Kode Barang", "Nama Barang", "Satuan Dasar", "Stok Awal", "Total Stok Masuk", "Total Stok Keluar", "Sisa Stok"];
    const data = rows.map((r) => [r.code, r.name, r.unit || "-", r.stockAwal, r.totalMasuk, r.totalKeluar, r.sisa]);
    const titleRows = [
      ["Laporan Mutasi Stock"],
      [`Gudang: ${whLabel}`],
      [`Periode: ${dateFrom || "-"} s/d ${dateTo || "-"}`],
      [],
      header,
    ];
    const ws = XLSX.utils.aoa_to_sheet([...titleRows, ...data]);
    ws["!cols"] = header.map(() => ({ wch: 18 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Mutasi Stock");
    XLSX.writeFile(wb, "laporan-mutasi-stock.xlsx");
  };

  const detailRows = useMemo(() => {
    if (!detailItem) return [];
    const k = norm(detailItem.itemName);
    const map = detailItem.type === "masuk" ? masukDetails : keluarDetails;
    return (map.get(k) || []).sort((a, b) => String(a.date).localeCompare(String(b.date)));
  }, [detailItem, masukDetails, keluarDetails]);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-slate-500">{rows.length} barang · Gudang: {whLabel} · Periode: {dateFrom || "-"} s/d {dateTo || "-"}</p>
        <button onClick={download} disabled={!rows.length} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"><Download className="h-4 w-4" />Download</button>
      </div>
      {isLoading ? (
        <div className="flex justify-center py-10"><div className="h-7 w-7 animate-spin rounded-full border-4 border-indigo-100 border-t-indigo-600" /></div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-400">Tidak ada data stok.</p>
      ) : (
        <div className="overflow-auto max-h-[60vh] rounded-2xl border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 shadow-sm">
              <tr>
                <th className="px-3 py-3 sticky left-0 bg-slate-50 z-20">Kode Barang</th>
                <th className="px-3 py-3">Nama Barang</th>
                <th className="px-3 py-3">Satuan Dasar</th>
                <th className="px-3 py-3 text-right">Stok Awal</th>
                <th className="px-3 py-3 text-right">Total Stok Masuk</th>
                <th className="px-3 py-3 text-right">Total Stok Keluar</th>
                <th className="px-3 py-3 text-right">Sisa Stok</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-indigo-50/40">
                  <td className="px-3 py-3 text-slate-600 sticky left-0 bg-white z-10 whitespace-nowrap">{r.code}</td>
                  <td className="px-3 py-3 font-medium text-slate-700 whitespace-nowrap">{r.name}</td>
                  <td className="px-3 py-3 text-slate-500 whitespace-nowrap">{r.unit || "-"}</td>
                  <td className="px-3 py-3 text-right whitespace-nowrap">{Number(r.stockAwal).toLocaleString("id-ID")}</td>
                  <td className="px-3 py-3 text-right whitespace-nowrap">
                    {r.totalMasuk > 0 ? <button onClick={() => setDetailItem({ itemName: r.name, type: "masuk" })} className="font-semibold text-emerald-700 hover:underline cursor-pointer">{Number(r.totalMasuk).toLocaleString("id-ID")}</button> : <span className="text-slate-400">0</span>}
                  </td>
                  <td className="px-3 py-3 text-right whitespace-nowrap">
                    {r.totalKeluar > 0 ? <button onClick={() => setDetailItem({ itemName: r.name, type: "keluar" })} className="font-semibold text-rose-700 hover:underline cursor-pointer">{Number(r.totalKeluar).toLocaleString("id-ID")}</button> : <span className="text-slate-400">0</span>}
                  </td>
                  <td className="px-3 py-3 text-right font-bold text-indigo-700 whitespace-nowrap">{Number(r.sisa).toLocaleString("id-ID")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={!!detailItem} onOpenChange={(o) => !o && setDetailItem(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Detail {detailItem?.type === "masuk" ? "Stok Masuk" : "Stok Keluar"} — {detailItem?.itemName || ""}</DialogTitle></DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto">
            {detailRows.length === 0 ? <p className="py-6 text-center text-sm text-slate-400">Tidak ada transaksi.</p> : (
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Tanggal</th>
                    <th className="px-3 py-2 text-right">Kuantitas</th>
                    <th className="px-3 py-2">Satuan</th>
                    <th className="px-3 py-2">Gudang</th>
                    <th className="px-3 py-2">Keterangan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {detailRows.map((d, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2 whitespace-nowrap text-slate-600">{d.date}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap font-medium text-slate-700">{Number(d.qty).toLocaleString("id-ID")}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-slate-500">{d.unit || "-"}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-slate-500">{d.warehouse || "-"}</td>
                      <td className="px-3 py-2 text-slate-500">{d.note || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
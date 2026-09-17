import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import * as XLSX from "xlsx";
import { base44 } from "@/api/base44Client";
import { convertToBase } from "../unitConversion";

const norm = (s) => (s || "").trim().toLowerCase();

export default function ReportItemShipment({ shipments, dateFrom, dateTo }) {
  const { data: stockItems = [] } = useQuery({ queryKey: ["stockItems"], queryFn: () => base44.entities.StockItem.list() });

  const itemMapByName = useMemo(() => {
    const m = new Map();
    for (const it of stockItems) {
      if (it.name) m.set(norm(it.name), it);
    }
    return m;
  }, [stockItems]);

  const rows = useMemo(() => {
    const result = [];
    for (const s of shipments) {
      const items = Array.isArray(s.do_items) ? s.do_items : [];
      for (const it of items) {
        const stockItem = itemMapByName.get(norm(it.name));
        const baseQty = convertToBase(stockItem, it.quantity, it.unit);
        const gramasi = stockItem?.gramasi || 0;
        const totalGramasi = gramasi * baseQty;
        result.push({
          doNumber: s.do_number || "-",
          date: s.delivery_date || "-",
          warehouse: s.warehouse || "-",
          outlet: s.outlet_name || "-",
          code: stockItem?.code || it.code || "-",
          name: it.name || "-",
          unit: it.unit || "-",
          quantity: it.quantity || 0,
          gramasi: totalGramasi,
        });
      }
    }
    return result.sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.doNumber).localeCompare(String(b.doNumber)));
  }, [shipments, itemMapByName]);

  const download = () => {
    const header = ["Tanggal", "No. Pengiriman #", "Gudang", "Outlet Tujuan", "Kode Barang", "Nama Barang", "Satuan", "Kuantitas", "Gramasi (dalam Kg)"];
    const data = rows.map((r) => [r.date, r.doNumber, r.warehouse, r.outlet, r.code, r.name, r.unit, r.quantity, r.gramasi || ""]);
    const titleRows = [
      ["Rincian Pengiriman Barang"],
      [`Dari ${dateFrom || "-"} s/d ${dateTo || "-"}`],
      [],
      header,
    ];
    const ws = XLSX.utils.aoa_to_sheet([...titleRows, ...data]);
    ws["!cols"] = header.map(() => ({ wch: 18 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Pengiriman Barang");
    XLSX.writeFile(wb, "rincian-pengiriman-barang.xlsx");
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-slate-500">{rows.length} item · Dari {dateFrom || "-"} s/d {dateTo || "-"}</p>
        <button onClick={download} disabled={!rows.length} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"><Download className="h-4 w-4" />Download</button>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-400">Tidak ada data pengiriman barang pada rentang ini.</p>
      ) : (
        <div className="overflow-auto max-h-[70vh] rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 whitespace-nowrap shadow-sm">
              <tr>
                <th className="px-3 py-3">Tanggal</th>
                <th className="px-3 py-3">No. Pengiriman #</th>
                <th className="px-3 py-3">Gudang</th>
                <th className="px-3 py-3">Outlet Tujuan</th>
                <th className="px-3 py-3">Kode Barang</th>
                <th className="px-3 py-3">Nama Barang</th>
                <th className="px-3 py-3">Satuan</th>
                <th className="px-3 py-3 text-right">Kuantitas</th>
                <th className="px-3 py-3 text-right">Gramasi (dalam Kg)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r, i) => (
                <tr key={i} className="hover:bg-indigo-50/40">
                  <td className="px-3 py-3 text-slate-600 whitespace-nowrap">{r.date}</td>
                  <td className="px-3 py-3 text-slate-600 whitespace-nowrap">{r.doNumber}</td>
                  <td className="px-3 py-3 text-slate-600 whitespace-nowrap">{r.warehouse}</td>
                  <td className="px-3 py-3 text-slate-600 whitespace-nowrap">{r.outlet}</td>
                  <td className="px-3 py-3 text-slate-600 whitespace-nowrap">{r.code}</td>
                  <td className="px-3 py-3 font-medium text-slate-700 whitespace-nowrap">{r.name}</td>
                  <td className="px-3 py-3 text-slate-600 whitespace-nowrap">{r.unit}</td>
                  <td className="px-3 py-3 text-right text-slate-600 whitespace-nowrap">{r.quantity}</td>
                  <td className="px-3 py-3 text-right text-slate-600 whitespace-nowrap">{r.gramasi ? Number(r.gramasi).toLocaleString("id-ID") : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
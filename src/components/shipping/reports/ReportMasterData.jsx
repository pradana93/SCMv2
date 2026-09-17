import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Download, Loader2 } from "lucide-react";
import * as XLSX from "xlsx";

export default function ReportMasterData() {
  const [downloading, setDownloading] = useState(false);

  const { data: stockItems = [] } = useQuery({ queryKey: ["stockItems"], queryFn: () => base44.entities.StockItem.list("-name", 5000) });
  const { data: warehouses = [] } = useQuery({ queryKey: ["warehouses"], queryFn: () => base44.entities.Warehouse.list("-name", 500) });
  const { data: outlets = [] } = useQuery({ queryKey: ["outlets"], queryFn: () => base44.entities.Outlet.list("-name", 5000) });
  const { data: vendors = [] } = useQuery({ queryKey: ["vendors"], queryFn: () => base44.entities.Vendor.list("-name", 500) });
  const { data: fleets = [] } = useQuery({ queryKey: ["fleets"], queryFn: () => base44.entities.Fleet.list("-name", 500) });
  const { data: categories = [] } = useQuery({ queryKey: ["categories"], queryFn: () => base44.entities.Category.list("-name", 500) });
  const { data: items = [] } = useQuery({ queryKey: ["items"], queryFn: () => base44.entities.Item.list("-name", 500) });
  const { data: masterPackingItems = [] } = useQuery({ queryKey: ["masterPackingItems"], queryFn: () => base44.entities.MasterPackingItem.list("-name", 500) });

  const download = () => {
    setDownloading(true);
    try {
      const wb = XLSX.utils.book_new();

      const ws1 = XLSX.utils.json_to_sheet(stockItems.map((it) => ({
        Nama: it.name || "", Kode: it.code || "", Barcode: it.barcode || "",
        Satuan: it.unit || "", Gramasi: it.gramasi || 0, Min_Stock: it.min_stock || 0,
        Kategori: it.category || "", Accurate_No: it.accurate_no || "",
        Gudang: Array.isArray(it.warehouses) ? it.warehouses.join(", ") : "",
      })));
      XLSX.utils.book_append_sheet(wb, ws1, "Barang Stok");

      const ws2 = XLSX.utils.json_to_sheet(warehouses.map((w) => ({ Nama: w.name || "", PIC: w.pic || "" })));
      XLSX.utils.book_append_sheet(wb, ws2, "Gudang");

      const ws3 = XLSX.utils.json_to_sheet(outlets.map((o) => ({ Nama: o.name || "", Pemilik: o.pemilik || "", ETA: o.eta || "" })));
      XLSX.utils.book_append_sheet(wb, ws3, "Outlet");

      const ws4 = XLSX.utils.json_to_sheet(vendors.map((v) => ({ Nama: v.name || "", Kontak: v.contact || "" })));
      XLSX.utils.book_append_sheet(wb, ws4, "Vendor");

      const ws5 = XLSX.utils.json_to_sheet(fleets.map((f) => ({ Nama: f.name || "", Plat: f.plate || "", Kontak: f.contact || "" })));
      XLSX.utils.book_append_sheet(wb, ws5, "Armada");

      const ws6 = XLSX.utils.json_to_sheet(categories.map((c) => ({ Nama: c.name || "" })));
      XLSX.utils.book_append_sheet(wb, ws6, "Kategori");

      const ws7 = XLSX.utils.json_to_sheet(items.map((it) => ({ Nama: it.name || "", Satuan: it.satuan || "" })));
      XLSX.utils.book_append_sheet(wb, ws7, "Item");

      const ws8 = XLSX.utils.json_to_sheet(masterPackingItems.map((m) => ({
        Nama: m.name || "", Qty_Max: m.qty_max || 0, Koli: m.koli || 0,
        Satuan: m.satuan || "", Keterangan: m.keterangan || "",
      })));
      XLSX.utils.book_append_sheet(wb, ws8, "Master Packing");

      XLSX.writeFile(wb, "master-data.xlsx", { bookType: "xlsx" });
    } finally {
      setDownloading(false);
    }
  };

  const counts = [
    { label: "Barang Stok", count: stockItems.length },
    { label: "Gudang", count: warehouses.length },
    { label: "Outlet", count: outlets.length },
    { label: "Vendor", count: vendors.length },
    { label: "Armada", count: fleets.length },
    { label: "Kategori", count: categories.length },
    { label: "Item", count: items.length },
    { label: "Master Packing", count: masterPackingItems.length },
  ];

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-slate-500">Download seluruh data master aplikasi dalam satu file Excel (multi-sheet).</p>
        <button onClick={download} disabled={downloading} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60">
          {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {downloading ? "Memproses..." : "Download Master Data"}
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {counts.map((c) => (
          <div key={c.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs text-slate-400">{c.label}</p>
            <p className="mt-1 text-2xl font-bold text-slate-800">{c.count}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
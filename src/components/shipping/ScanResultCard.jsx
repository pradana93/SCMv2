import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Package, AlertCircle, ArrowRight, Truck, Plus, Minus, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStockCurrent } from "@/components/shipping/useStockCurrent";
import { ALL_WAREHOUSES } from "@/components/shipping/shippingUtils";
import { formatDateId } from "@/components/shipping/shipmentBarcodeUtils";

export default function ScanResultCard({ result, scanType, onDone }) {
  const navigate = useNavigate();
  const { currentFor, unitsFor, gramasiFor } = useStockCurrent();

  const item = result?.item;
  const unitList = useMemo(() => (item ? unitsFor(item.name) : []), [item, unitsFor]);

  if (!result) return null;

  // Case: shipment barcode
  if (result.type === "shipment") {
    const d = result.decoded;
    return (
      <div className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600"><Truck className="h-5 w-5" /></div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-slate-800">Barcode Pengiriman Terdeteksi</p>
            <p className="mt-0.5 text-xs text-slate-500">Jenis: {d.type === "do" ? "Delivery Order (DO)" : "Item Pengiriman"} · Tgl Kedatangan: {formatDateId(d.date)}</p>
            <p className="mt-0.5 truncate text-[11px] text-slate-400">{result.barcode}</p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button onClick={() => navigate("/pengiriman")} className="gap-1.5"><ArrowRight className="h-4 w-4" />Buka Halaman Pengiriman</Button>
          <Button variant="outline" onClick={onDone}>Tutup</Button>
        </div>
      </div>
    );
  }

  // Case: not found
  if (result.type === "not_found") {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-600"><AlertCircle className="h-5 w-5" /></div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-slate-800">Barcode Tidak Ditemukan</p>
            <p className="mt-0.5 text-xs text-slate-500">Barcode <span className="font-mono font-semibold">{result.barcode}</span> tidak terdaftar di master barang.</p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="outline" onClick={onDone}>Tutup</Button>
        </div>
      </div>
    );
  }

  // Case: item found
  const stockAll = item ? currentFor(item.name, ALL_WAREHOUSES) : 0;
  const gramasi = item ? gramasiFor(item.name) : 0;
  const isLow = Number(item?.min_stock) > 0 && stockAll <= Number(item.min_stock);

  const goTx = (type) => navigate(`/stok?open=tx&item=${item.id}&type=${type}`);
  const goCard = () => navigate(`/stok?open=card&item=${item.id}`);

  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/30 p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600"><Package className="h-5 w-5" /></div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-slate-800">{item.name}</p>
          <p className="mt-0.5 text-xs text-slate-500">{item.code || "tanpa kode"} · {item.category || "Tanpa Kategori"}</p>
          <p className="mt-0.5 truncate text-[11px] text-slate-400">Barcode: {result.barcode}</p>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${scanType === "masuk" ? "bg-emerald-100 text-emerald-700" : scanType === "keluar" ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-600"}`}>
          {scanType === "masuk" ? "Barang Masuk" : scanType === "keluar" ? "Barang Keluar" : "Cek Stok"}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-xl bg-white px-3 py-2">
          <p className="text-slate-400">Stok Saat Ini (semua gudang)</p>
          <p className={`text-sm font-bold ${isLow ? "text-rose-600" : "text-slate-800"}`}>{Number(stockAll).toLocaleString("id-ID")} <span className="text-xs font-normal text-slate-400">{item.unit || ""}</span></p>
          {isLow && <p className="mt-0.5 text-[10px] font-medium text-rose-500">Di bawah min stok!</p>}
        </div>
        <div className="rounded-xl bg-white px-3 py-2">
          <p className="text-slate-400">Min Stok / Gramasi</p>
          <p className="text-sm font-bold text-slate-800">{Number(item.min_stock || 0).toLocaleString("id-ID")} <span className="text-xs font-normal text-slate-400">{item.unit || ""}</span></p>
          {gramasi > 0 && <p className="mt-0.5 text-[10px] text-slate-400">{gramasi.toLocaleString("id-ID")} kg/satuan</p>}
        </div>
      </div>

      {unitList.length > 0 && (
        <div className="mt-2 rounded-xl bg-white px-3 py-2 text-xs">
          <p className="text-slate-400">Satuan tersedia</p>
          <p className="text-sm font-medium text-slate-700">{unitList.map((u) => u.name).join(", ")}</p>
        </div>
      )}

      <div className="mt-3">
        <p className="mb-2 text-xs font-semibold text-slate-600">Aksi Cepat</p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => goTx("masuk")} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"><Plus className="h-4 w-4" />Tambah Stok</Button>
          <Button onClick={() => goTx("keluar")} className="gap-1.5 bg-rose-600 hover:bg-rose-700"><Minus className="h-4 w-4" />Kurangi Stok</Button>
          <Button variant="outline" onClick={goCard} className="gap-1.5"><BarChart3 className="h-4 w-4" />Kartu Stok</Button>
          <Button variant="ghost" onClick={onDone}>Tutup</Button>
        </div>
      </div>
    </div>
  );
}
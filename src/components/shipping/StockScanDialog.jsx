import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import BarcodeScanner from "@/components/shipping/BarcodeScanner";
import DoDetailDialog from "@/components/shipping/DoDetailDialog";
import { decodeBarcode, decodeKoliBarcode, formatDateId } from "@/components/shipping/shipmentBarcodeUtils";
import { ScanLine } from "lucide-react";

const normKey = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

const genBarcodeValue = (item) => {
  if (item.barcode) return item.barcode;
  if (item.code) return item.code;
  return `WMS${String(item.id || "").slice(-8).replace(/[^a-z0-9]/gi, "").toUpperCase().padStart(6, "0")}`;
};

export default function StockScanDialog({ open, onClose, onStockCheck }) {
  const navigate = useNavigate();
  const [scanMode, setScanMode] = useState("cek_koli");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanMsg, setScanMsg] = useState(null);
  const [doDetail, setDoDetail] = useState(null);
  const qc = useQueryClient();

  const { data: items = [] } = useQuery({ queryKey: ["stockItems"], queryFn: () => base44.entities.StockItem.list() });
  const { data: shipments = [] } = useQuery({ queryKey: ["shipments", "stockScan"], queryFn: () => base44.entities.Shipment.list("-delivery_date", 500) });

  const onScan = async (barcode) => {
    const decoded = decodeBarcode(barcode);
    // Koli barcode → open the koli sticker detail page
    const koli = decodeKoliBarcode(barcode);
    if (koli) {
      await base44.entities.BarcodeScan.create({
        barcode, scan_type: "cek_stok", scanned_by: "user", match_status: "sesuai",
        reference_type: "koli_sticker", reference_label: `Koli ${koli.koliNum}`,
        scanned_at: new Date().toISOString(), note: `Scan barcode koli: ${koli.koliNum}`,
      }).catch(() => {});
      qc.invalidateQueries({ queryKey: ["barcodeScans"] });
      setScannerOpen(false);
      onClose();
      navigate(`/koli/${koli.suffix}/${encodeURIComponent(koli.koliNum)}`);
      return;
    }
    // In cek_koli mode, only koli barcodes are accepted
    if (scanMode === "cek_koli") {
      setScanMsg({ type: "error", text: `Barcode "${barcode}" bukan barcode koli. Pastikan memindai stiker label koli.` });
      await base44.entities.BarcodeScan.create({ barcode, scan_type: "cek_stok", scanned_by: "user", match_status: "tidak_ditemukan", scanned_at: new Date().toISOString(), note: "Mode Cek Koli: barcode koli tidak dikenali" }).catch(() => {});
      qc.invalidateQueries({ queryKey: ["barcodeScans"] });
      setScannerOpen(false);
      return;
    }
    // In cek_pengiriman mode, always try to match the raw barcode against shipments first
    if (scanMode === "cek_pengiriman") {
      const bc = String(barcode || "").trim();
      const bcNorm = normKey(bc);
      const match = shipments.find((s) => {
        if (!s) return false;
        if (s.do_barcode && normKey(s.do_barcode) === bcNorm) return true;
        if (s.do_number && normKey(s.do_number) === bcNorm) return true;
        if (Array.isArray(s.do_items) && s.do_items.some((it) => it.barcode && normKey(it.barcode) === bcNorm)) return true;
        return false;
      });
      await base44.entities.BarcodeScan.create({
        barcode, scan_type: scanMode, scanned_by: "user", match_status: match ? "sesuai" : "tidak_ditemukan",
        reference_type: decoded ? (decoded.type === "do" ? "shipment_do" : "shipment_item") : "shipment_do",
        scanned_at: new Date().toISOString(), note: decoded ? `Tgl kirim: ${decoded.date}` : "Scan barcode pengiriman",
      }).catch(() => {});
      qc.invalidateQueries({ queryKey: ["barcodeScans"] });
      if (match) {
        setScanMsg({ type: "success", text: `DO ditemukan: ${match.outlet_name || "-"} — ${match.do_number || ""}` });
        setDoDetail(match);
      } else {
        setScanMsg({ type: "error", text: decoded ? `Barcode pengiriman terdeteksi (Tgl: ${formatDateId(decoded.date)}) tetapi data DO tidak ditemukan.` : `Barcode "${barcode}" tidak cocok dengan DO manapun.` });
      }
      setScannerOpen(false);
      return;
    }
    // In cek_stok mode, if barcode is a shipment barcode, warn the user
    if (decoded) {
      setScanMsg({ type: "error", text: `Barcode pengiriman terdeteksi. Gunakan mode "Cek Pengiriman" untuk memeriksa DO.` });
      setScannerOpen(false);
      return;
    }
    const item = items.find((it) => (it.barcode || genBarcodeValue(it)) === barcode || it.code === barcode || (it.barcode && normKey(it.barcode) === normKey(barcode)) || (it.code && normKey(it.code) === normKey(barcode)));
    if (!item) {
      setScanMsg({ type: "error", text: `Barcode "${barcode}" tidak ditemukan di master barang.` });
      await base44.entities.BarcodeScan.create({ barcode, scan_type: scanMode, scanned_by: "user", match_status: "tidak_ditemukan", scanned_at: new Date().toISOString() }).catch(() => {});
      qc.invalidateQueries({ queryKey: ["barcodeScans"] });
      setScannerOpen(false);
      return;
    }
    setScanMsg({ type: "success", text: `${item.name} — ${item.code || ""}` });
    await base44.entities.BarcodeScan.create({
      barcode, item_name: item.name, item_code: item.code || "",
      scan_type: scanMode, scanned_by: "user", match_status: "sesuai",
      quantity: 1, unit: item.unit || "", scanned_at: new Date().toISOString(),
    }).catch(() => {});
    qc.invalidateQueries({ queryKey: ["barcodeScans"] });
    setScannerOpen(false);
    onStockCheck(item);
  };

  return (
    <>
      <Dialog open={open && !scannerOpen} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><ScanLine className="h-5 w-5 text-indigo-600" />Scan Barcode</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <select value={scanMode} onChange={(e) => { setScanMode(e.target.value); setScanMsg(null); }} className="flex-1 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100">
                <option value="cek_koli">Cek Koli</option>
                <option value="cek_stok">Cek Stok</option>
                <option value="cek_pengiriman">Cek Pengiriman</option>
              </select>
              <Button onClick={() => { setScanMsg(null); setScannerOpen(true); }} className="gap-1.5"><ScanLine className="h-4 w-4" />Buka Kamera</Button>
            </div>
            {scanMsg && (
              <div className={`rounded-xl p-3 text-sm ${scanMsg.type === "success" ? "bg-emerald-50 text-emerald-700" : scanMsg.type === "error" ? "bg-rose-50 text-rose-700" : "bg-slate-50 text-slate-700"}`}>
                {scanMsg.text}
              </div>
            )}
            <p className="text-xs text-slate-500">
              {scanMode === "cek_koli" ? "Arahkan kamera ke stiker label koli untuk melihat detail isi koli." : scanMode === "cek_stok" ? "Arahkan kamera ke barcode barang untuk langsung melihat kartu stok." : "Arahkan kamera ke barcode DO/pengiriman untuk melihat detail pengiriman."}
            </p>
          </div>
        </DialogContent>
      </Dialog>
      {scannerOpen && <BarcodeScanner onScan={onScan} onClose={() => setScannerOpen(false)} title={`Scan Barcode — ${scanMode === "cek_koli" ? "Cek Koli" : scanMode === "cek_stok" ? "Cek Stok" : "Cek Pengiriman"}`} />}
      <DoDetailDialog item={doDetail} onClose={() => setDoDetail(null)} />
    </>
  );
}
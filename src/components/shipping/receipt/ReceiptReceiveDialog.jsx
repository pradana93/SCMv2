import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Timer, Trash2, ScanLine, CheckCircle2 } from "lucide-react";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { base44 } from "@/api/base44Client";
import BarcodeScanner from "@/components/shipping/BarcodeScanner";
import { useStockCurrent } from "@/components/shipping/useStockCurrent";

const inputClass = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";
const today = () => new Date().toISOString().slice(0, 10);
const normKey = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

export default function ReceiptReceiveDialog({ open, onClose, onSave, record, processes = [], busy }) {
  const [receiveDate, setReceiveDate] = useState(today());
  const [stockKeeper, setStockKeeper] = useState("");
  const [crewCount, setCrewCount] = useState("");
  const [note, setNote] = useState("");
  const [rows, setRows] = useState([]);
  const [scanRowIdx, setScanRowIdx] = useState(null);
  const [openItems, setOpenItems] = useState([]);
  const { data: stockItems = [] } = useQuery({ queryKey: ["stockItems"], queryFn: () => base44.entities.StockItem.list(), enabled: open });
  const { calcItemTonnage, gramasiFor } = useStockCurrent();

  const barcodeMap = (stockItems || []).reduce((m, it) => {
    if (it.barcode) m[it.barcode] = it.name;
    if (it.code) m[it.code] = it.name;
    return m;
  }, {});
  const matchByBarcode = (barcode) => barcodeMap[barcode] || null;

  useEffect(() => {
    if (!open) return;
    setReceiveDate(record?.arrival_date || today());
    setStockKeeper("");
    setCrewCount("");
    setNote("");
    const accumMap = new Map();
    for (const proc of (processes || [])) {
      for (const it of (proc.received_items || [])) {
        const k = normKey(it.item_name);
        accumMap.set(k, (accumMap.get(k) || 0) + Number(it.quantity || 0));
      }
    }
    const itemRows = (Array.isArray(record?.items) ? record.items : []).map((it) => {
      const k = normKey(it.item_name);
      const remaining = Math.max(0, Number(it.quantity || 0) - (accumMap.get(k) || 0));
      const calcT = calcItemTonnage({ item_name: it.item_name, quantity: remaining, unit: it.unit });
      const hasGramasi = gramasiFor(it.item_name) > 0;
      return { item_name: it.item_name || "", quantity: String(remaining), unit: it.unit || "", tonnage: hasGramasi ? String(calcT) : String(it.tonnage ?? ""), note: "", _autoTonnage: hasGramasi };
    });
    setRows(itemRows);
    setOpenItems(itemRows.map((_, i) => `item-${i}`));
  }, [open, record, processes]);

  const setRow = (i, field, value) => setRows((p) => p.map((r, idx) => {
    if (idx !== i) return r;
    const next = { ...r, [field]: value };
    if (r._autoTonnage && (field === "quantity" || field === "unit")) {
      next.tonnage = String(calcItemTonnage({ item_name: r.item_name, quantity: Number(next.quantity) || 0, unit: next.unit }));
    }
    return next;
  }));
  const removeRow = (i) => setRows((p) => p.filter((_, idx) => idx !== i));

  const onScan = (barcode) => {
    const matchedName = matchByBarcode(barcode);
    if (scanRowIdx !== null) {
      // Scan untuk baris tertentu — verifikasi cocok/tidak
      const row = rows[scanRowIdx];
      const isMatch = matchedName && normKey(matchedName) === normKey(row.item_name);
      setRow(scanRowIdx, "scanned", isMatch ? "sesuai" : "tidak_sesuai");
      setRow(scanRowIdx, "scan_barcode", barcode);
      setScanRowIdx(null);
    } else {
      // Scan global — tandai baris yang cocok
      if (!matchedName) return;
      const idx = rows.findIndex((r) => normKey(r.item_name) === normKey(matchedName));
      if (idx >= 0) setRow(idx, "scanned", "sesuai");
    }
  };

  const submit = () => {
    if (!receiveDate || !stockKeeper.trim() || !crewCount) return;
    const validRows = rows.filter((r) => r.item_name && (Number(r.quantity) > 0 || Number(r.tonnage) > 0));
    if (!validRows.length) return;
    onSave({
      id: record.id,
      received_date: receiveDate,
      stock_keeper_name: stockKeeper.trim(),
      crew_count: Number(crewCount) || 0,
      note: note.trim(),
      received_items: validRows.map((r) => ({
        item_name: r.item_name, quantity: Number(r.quantity) || 0, unit: r.unit.trim(),
        tonnage: Number(r.tonnage) || 0, note: r.note.trim(),
      })),
      receive_start_ts: new Date().toISOString(),
      status: "dalam_proses",
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Buat Proses Penerimaan</DialogTitle></DialogHeader>
        <p className="-mt-2 text-xs text-slate-500">{record?.sender_name || "-"} · {record?.warehouse || "-"}</p>
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-medium">Tanggal Penerimaan<input type="date" value={receiveDate} onChange={(e) => setReceiveDate(e.target.value)} className={`mt-1.5 ${inputClass}`} /></label>
            <label className="block text-sm font-medium">Nama Stock Keeper<input value={stockKeeper} onChange={(e) => setStockKeeper(e.target.value)} className={`mt-1.5 ${inputClass}`} placeholder="Nama stock keeper" /></label>
          </div>
          <label className="block text-sm font-medium">Jumlah Crew<input type="number" min="0" value={crewCount} onChange={(e) => setCrewCount(e.target.value)} className={`mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 sm:max-w-[200px]`} placeholder="0" /></label>
          <div>
            <p className="mb-1.5 text-sm font-medium">Daftar Barang</p>
            <p className="mb-2 text-[11px] text-slate-400">Kuantitas terisi sisa yang belum diterima. Tonase terisi dari rencana, dapat diedit jika tidak sesuai.</p>
            <Accordion type="multiple" value={openItems} onValueChange={setOpenItems} className="space-y-2">
              {rows.map((r, i) => (
                <AccordionItem key={i} value={`item-${i}`} className="rounded-xl border border-slate-200 px-3 mb-2 last:mb-0 last:border-b">
                  <AccordionTrigger className="hover:no-underline py-3">
                    <div className="flex items-center gap-2 flex-1 pr-2">
                      <p className="text-sm font-bold text-slate-800 text-left">{r.item_name}</p>
                      {r.scanned === "sesuai" && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600"><CheckCircle2 className="h-3 w-3" />Terverifikasi</span>}
                      {r.scanned === "tidak_sesuai" && <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-600">Barcode tidak cocok</span>}
                      <span className="ml-auto text-xs font-semibold text-slate-500">{r.quantity} {r.unit}</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <label className="text-xs font-medium">Kuantitas Aktual<input type="number" min="0" value={r.quantity} onChange={(e) => setRow(i, "quantity", e.target.value)} className={`mt-1 ${inputClass}`} placeholder="0" /></label>
                      <label className="text-xs font-medium">Satuan<input value={r.unit} readOnly className={`mt-1 ${inputClass} bg-slate-50 text-slate-500`} placeholder="-" /></label>
                      <label className="text-xs font-medium">Tonase (kg) {r._autoTonnage ? "(auto)" : "*"}<input type="number" min="0" step="0.01" value={r.tonnage} onChange={(e) => setRow(i, "tonnage", e.target.value)} readOnly={r._autoTonnage} className={`mt-1 ${inputClass} ${r._autoTonnage ? "bg-slate-50 text-slate-500" : ""}`} placeholder="0" /></label>
                      <label className="text-xs font-medium">Keterangan<input value={r.note} onChange={(e) => setRow(i, "note", e.target.value)} className={`mt-1 ${inputClass}`} placeholder="Catatan" /></label>
                    </div>
                    <div className="mt-2 flex items-center justify-end gap-1">
                      <button type="button" onClick={() => setScanRowIdx(i)} className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-600 transition hover:bg-indigo-100"><ScanLine className="h-3.5 w-3.5" />Scan Barcode</button>
                      {rows.length > 1 && <button type="button" onClick={() => removeRow(i)} className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-2 py-1 text-xs font-semibold text-red-600 transition hover:bg-red-100"><Trash2 className="h-3.5 w-3.5" />Hapus</button>}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
          <label className="block text-sm font-medium">Catatan Umum<input value={note} onChange={(e) => setNote(e.target.value)} className={`mt-1.5 ${inputClass}`} placeholder="Catatan (opsional)" /></label>
          <p className="text-xs text-slate-400"><Timer className="mr-1 inline h-3 w-3" />Setelah diklik, timer penerimaan berjalan dengan format HH:MM:SS.</p>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Batal</Button><Button onClick={submit} disabled={busy || !receiveDate || !stockKeeper.trim() || !crewCount || !rows.some((r) => Number(r.quantity) > 0 || Number(r.tonnage) > 0)}>{busy ? "Menyimpan..." : "Proses Penerimaan"}</Button></DialogFooter>
      </DialogContent>
      {scanRowIdx !== null && (
        <BarcodeScanner
          onScan={onScan}
          onClose={() => setScanRowIdx(null)}
          title={`Scan: ${rows[scanRowIdx]?.item_name || ""}`}
        />
      )}
    </Dialog>
  );
}
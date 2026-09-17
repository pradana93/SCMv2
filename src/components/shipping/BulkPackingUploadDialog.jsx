import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Upload, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { parsePackingListFile } from "@/components/shipping/parsePackingList";
import { formatDateId } from "@/components/shipping/shipmentBarcodeUtils";

const normKey = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

export default function BulkPackingUploadDialog({ open, onClose }) {
  const qc = useQueryClient();
  const { data: shipments = [] } = useQuery({ queryKey: ["shipments", "bulkPacking"], queryFn: () => base44.entities.Shipment.list("-delivery_date", 1000) });
  const [parsedSheets, setParsedSheets] = useState([]);
  const [file, setFile] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState(null);

  const handleFile = async (f) => {
    if (!f) return;
    setFile(f);
    setError("");
    setParsing(true);
    setResults(null);
    try {
      const sheets = await parsePackingListFile(f);
      if (!sheets.length) { setError("Tidak ada sheet dengan format packing list yang dikenali."); setParsedSheets([]); return; }
      const matched = sheets.map((sheet) => {
        const doNo = sheet.delivery_no || "";
        const shipment = doNo ? shipments.find((s) => normKey(s.do_number) === normKey(doNo)) : null;
        return { sheet, shipment: shipment || null, doNo };
      });
      setParsedSheets(matched);
    } catch {
      setError("Gagal membaca file. Pastikan format sesuai contoh.");
    } finally { setParsing(false); }
  };

  const matchedCount = parsedSheets.filter((p) => p.shipment).length;
  const unmatchedCount = parsedSheets.length - matchedCount;

  const submit = async () => {
    const toSave = parsedSheets.filter((p) => p.shipment);
    if (!toSave.length) return;
    setSaving(true);
    setError("");
    try {
      let fileUrl = "";
      if (file) {
        try { const res = await base44.integrations.Core.UploadFile({ file }); fileUrl = res.file_url; } catch {}
      }
      for (const { sheet, shipment } of toSave) {
        const update = { packing_list_data: [sheet] };
        if (fileUrl) update.proof_packing_url = fileUrl;
        await base44.entities.Shipment.update(shipment.id, update);
      }
      qc.invalidateQueries({ queryKey: ["shipments"] });
      setResults({ saved: toSave.length, total: parsedSheets.length });
      setParsedSheets([]);
      setFile(null);
    } catch {
      setError("Gagal menyimpan packing list.");
    } finally { setSaving(false); }
  };

  const reset = () => { setParsedSheets([]); setFile(null); setError(""); setResults(null); };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); onClose(); } }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Upload Packing List (Multi-DO)</DialogTitle></DialogHeader>
        <p className="-mt-2 text-xs text-slate-500">Upload file Excel packing list (multi-sheet). Setiap sheet akan otomatis dicocokkan ke pengiriman berdasarkan Nomor DO/IT dan disimpan ke detail DO.</p>

        {results ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center">
            <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600" />
            <p className="mt-2 text-sm font-semibold text-emerald-700">{results.saved} packing list berhasil disimpan ke {results.saved} pengiriman.</p>
            {results.total > results.saved && <p className="mt-1 text-xs text-amber-600">{results.total - results.saved} sheet tidak ditemukan DO yang cocok.</p>}
          </div>
        ) : (
          <>
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-4">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700">
                <Upload className="h-4 w-4" />{file ? file.name : "Pilih File Excel"}
                <input type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => handleFile(e.target.files?.[0] || null)} disabled={parsing || saving} />
              </label>
              {parsing && <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500"><Loader2 className="h-3.5 w-3.5 animate-spin" />Memproses file...</p>}
              {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
            </div>

            {parsedSheets.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-600">{matchedCount} cocok · {unmatchedCount} tidak ditemukan</span>
                  <span className="text-slate-400">{parsedSheets.length} sheet</span>
                </div>
                <div className="max-h-64 space-y-1.5 overflow-y-auto">
                  {parsedSheets.map((p, i) => (
                    <div key={i} className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-xs ${p.shipment ? "border-emerald-200 bg-emerald-50/50" : "border-rose-200 bg-rose-50/50"}`}>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-700">{p.doNo || "Tanpa DO"}</p>
                        <p className="truncate text-slate-400">{p.sheet.ship_to || p.sheet.sheet_name} · {p.sheet.items.length} item · {formatDateId(p.sheet.delivery_date)}</p>
                      </div>
                      {p.shipment ? (
                        <span className="flex shrink-0 items-center gap-1 text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5" />{p.shipment.outlet_name}</span>
                      ) : (
                        <span className="flex shrink-0 items-center gap-1 text-rose-500"><XCircle className="h-3.5 w-3.5" />Tidak cocok</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        <DialogFooter>
          {results ? (
            <Button onClick={() => { reset(); onClose(); }}>Tutup</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => { reset(); onClose(); }} disabled={saving}>Batal</Button>
              <Button onClick={submit} disabled={saving || parsing || matchedCount === 0}>{saving ? "Menyimpan..." : `Simpan ${matchedCount} Packing List`}</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
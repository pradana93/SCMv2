import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, FileText, X } from "lucide-react";
import { base44 } from "@/api/base44Client";

const inputClass = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";

export default function ReceiptFinishDialog({ open, onClose, onSave, record, busy, isSuperAdmin }) {
  const [matchStatus, setMatchStatus] = useState("");
  const [rows, setRows] = useState([]);
  const [suratJalanUrl, setSuratJalanUrl] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMatchStatus("");
    setSuratJalanUrl(record?.surat_jalan_url || "");
    setRows((Array.isArray(record?.received_items) ? record.received_items : []).map((it) => ({
      item_name: it.item_name || "",
      quantity: String(it.quantity ?? ""),
      unit: it.unit || "",
      tonnage: String(it.tonnage ?? ""),
      note: it.note || "",
    })));
  }, [open, record]);

  const setRow = (i, field, value) => setRows((p) => p.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setSuratJalanUrl(file_url);
    } catch { alert("Gagal mengupload file."); } finally { setUploading(false); }
  };

  const submit = () => {
    if (!matchStatus) return;
    if (!isSuperAdmin && !suratJalanUrl) return;
    const endTs = new Date().toISOString();
    const start = record?.receive_start_ts;
    const duration = start ? Math.floor((new Date(endTs).getTime() - new Date(start).getTime()) / 1000) : 0;
    onSave({
      id: record.id,
      match_status: matchStatus,
      surat_jalan_url: suratJalanUrl,
      received_items: rows.map((r) => ({
        item_name: r.item_name, quantity: Number(r.quantity) || 0, unit: r.unit.trim(),
        tonnage: Number(r.tonnage) || 0, note: r.note.trim(),
      })),
      receive_end_ts: endTs,
      receive_duration: duration,
      status: "menunggu_verifikasi",
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Selesaikan Proses Penerimaan</DialogTitle></DialogHeader>
        <p className="-mt-2 text-xs text-slate-500">{record?.sender_name || "-"} · {record?.warehouse || "-"}</p>
        <div className="space-y-3">
          <label className="block text-sm font-medium">Status Data
            <select value={matchStatus} onChange={(e) => setMatchStatus(e.target.value)} className={`mt-1.5 ${inputClass}`}>
              <option value="" disabled>Pilih status</option>
              <option value="sesuai">Data Sesuai</option>
              <option value="tidak_sesuai">Data Tidak Sesuai</option>
            </select>
          </label>
          {matchStatus === "tidak_sesuai" && <p className="text-xs text-amber-600">Anda dapat mengedit kuantitas dan tonase sesuai aktual.</p>}
          <div>
            <p className="mb-1.5 text-sm font-medium">Barang Diterima {matchStatus === "tidak_sesuai" ? "(dapat diedit)" : ""}</p>
            <div className="space-y-2">
              {rows.map((r, i) => (
                <div key={i} className="rounded-xl border border-slate-200 p-3">
                  <p className="text-sm font-bold text-slate-800">{r.item_name}</p>
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <label className="text-xs font-medium">Kuantitas<input type="number" min="0" value={r.quantity} onChange={(e) => setRow(i, "quantity", e.target.value)} disabled={matchStatus !== "tidak_sesuai"} className={`mt-1 ${inputClass} ${matchStatus !== "tidak_sesuai" ? "bg-slate-50 text-slate-500" : ""}`} placeholder="0" /></label>
                    <label className="text-xs font-medium">Satuan<input value={r.unit} readOnly className={`mt-1 ${inputClass} bg-slate-50 text-slate-500`} placeholder="-" /></label>
                    <label className="text-xs font-medium">Tonase (kg)<input type="number" min="0" step="0.01" value={r.tonnage} onChange={(e) => setRow(i, "tonnage", e.target.value)} disabled={matchStatus !== "tidak_sesuai"} className={`mt-1 ${inputClass} ${matchStatus !== "tidak_sesuai" ? "bg-slate-50 text-slate-500" : ""}`} placeholder="0" /></label>
                    <label className="text-xs font-medium">Keterangan<input value={r.note} onChange={(e) => setRow(i, "note", e.target.value)} className={`mt-1 ${inputClass}`} placeholder="Catatan (opsional)" /></label>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-sm font-medium">Bukti Surat Jalan {!isSuperAdmin && <span className="text-red-500">*</span>}</p>
            {suratJalanUrl ? (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/50 px-3 py-2">
                <FileText className="h-4 w-4 text-emerald-600" />
                <a href={suratJalanUrl} target="_blank" rel="noreferrer" className="flex-1 truncate text-xs font-medium text-emerald-700 underline">Lihat file</a>
                <button onClick={() => setSuratJalanUrl("")} className="rounded p-1 text-red-600 hover:bg-red-50"><X className="h-3.5 w-3.5" /></button>
              </div>
            ) : (
              <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-slate-300 px-3 py-2.5 text-sm text-slate-500 transition hover:bg-slate-50">
                <Upload className="h-4 w-4" />{uploading ? "Mengupload..." : "Upload file (PDF/JPG)"}
                <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFile} className="hidden" disabled={uploading} />
              </label>
            )}
          </div>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Batal</Button><Button onClick={submit} disabled={busy || !matchStatus || (!isSuperAdmin && !suratJalanUrl)}>{busy ? "Menyimpan..." : "Proses Selesai"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
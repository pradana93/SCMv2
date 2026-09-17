import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Upload, Loader2 } from "lucide-react";

export default function DeliveredDialog({ open, onClose, onSubmit, outletName, tonnage }) {
  const [file, setFile] = useState(null);
  const [checkerName, setCheckerName] = useState("");
  const [crewCount, setCrewCount] = useState("");
  const [tonnageVal, setTonnageVal] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { if (open) { setTonnageVal(tonnage != null ? String(tonnage) : ""); } }, [open, tonnage]);

  const reset = () => { setFile(null); setCheckerName(""); setCrewCount(""); setError(""); };

  const submit = async (e) => {
    e.preventDefault();
    if (!file) { setError("File bukti wajib diunggah (JPG atau PDF)."); return; }
    if (!checkerName.trim()) { setError("Nama checker wajib diisi."); return; }
    if (!crewCount || Number(crewCount) <= 0) { setError("Jumlah crew harus berupa angka lebih dari 0."); return; }
    if (!tonnageVal || Number(tonnageVal) <= 0) { setError("Total tonase harus berupa angka lebih dari 0."); return; }
    setSubmitting(true); setError("");
    try {
      await onSubmit({ file, checker_name: checkerName.trim(), crew_count: Number(crewCount), tonnage: Number(tonnageVal) });
      reset();
      onClose();
    } catch {
      setError("Gagal menyimpan. Silakan coba lagi.");
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = "mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";

  return <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); onClose(); } }}>
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Konfirmasi Pengiriman Selesai</DialogTitle>
        <DialogDescription>Lengkapi data berikut untuk mengubah status menjadi "Sudah Dikirim".</DialogDescription>
      </DialogHeader>
      {outletName && <p className="rounded-xl bg-slate-50 px-4 py-2.5 text-sm text-slate-600">Outlet: <span className="font-semibold text-slate-900">{outletName}</span></p>}
      <form onSubmit={submit} className="space-y-4">
        <label className="text-sm font-medium">Upload Bukti (JPG / PDF)
          <div className="mt-1.5 flex items-center gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold transition hover:bg-slate-50">
              <Upload className="h-4 w-4" />Pilih File
              <input type="file" accept=".jpg,.jpeg,.pdf" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            </label>
            <span className="text-sm text-slate-500">{file ? file.name : "Belum ada file"}</span>
          </div>
        </label>
        <label className="text-sm font-medium">Total Tonase (kg)<input type="number" min="0" step="0.1" value={tonnageVal} onChange={(e) => setTonnageVal(e.target.value)} className={inputClass} placeholder="0" /></label>
        <label className="text-sm font-medium">Nama Checker<input value={checkerName} onChange={(e) => setCheckerName(e.target.value)} className={inputClass} placeholder="Contoh: Andi" /></label>
        <label className="text-sm font-medium">Jumlah Crew<input type="number" min="1" step="1" value={crewCount} onChange={(e) => setCrewCount(e.target.value)} className={inputClass} placeholder="0" /></label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <DialogFooter className="gap-2">
          <button type="button" onClick={() => { reset(); onClose(); }} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold transition hover:bg-slate-50">Batal</button>
          <button type="submit" disabled={submitting} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60">{submitting && <Loader2 className="h-4 w-4 animate-spin" />}{submitting ? "Menyimpan..." : "Konfirmasi Dikirim"}</button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
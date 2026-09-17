import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Check, X } from "lucide-react";

const JENIS_OPTIONS = [
  { value: "kurang_kirim", label: "Kurang Kirim" },
  { value: "lebih_kirim", label: "Lebih Kirim" },
  { value: "rusak_waste", label: "Rusak/Waste" },
  { value: "salah_input", label: "Salah Input" },
  { value: "lainnya", label: "Lainnya" },
];
const KATEGORI_OPTIONS = [
  { value: "human_error", label: "Human Error" },
  { value: "barang_waste", label: "Barang Waste" },
  { value: "lainnya", label: "Lainnya" },
];

const Chip = ({ active, onClick, label }) => (
  <button type="button" onClick={onClick} className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-medium transition ${active ? "border-indigo-500 bg-indigo-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:bg-indigo-50/50"}`}>
    {active && <Check className="h-3.5 w-3.5" />}{label}
  </button>
);

export default function AccuracyDialog({ open, onClose, onSubmit, outletName, accuracy, complaintReason, complaintType, complaintCategory }) {
  const [value, setValue] = useState("data_belum_tersedia");
  const [jenis, setJenis] = useState([]);
  const [kategori, setKategori] = useState([]);
  const [ket, setKet] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setValue(accuracy || "data_belum_tersedia");
      setJenis(Array.isArray(complaintType) ? complaintType : (complaintType ? [complaintType] : []));
      setKategori(Array.isArray(complaintCategory) ? complaintCategory : (complaintCategory ? [complaintCategory] : []));
      setKet(complaintReason || "");
      setError("");
    }
  }, [open, accuracy, complaintReason, complaintType, complaintCategory]);

  const toggle = (list, setList, v) => setList((prev) => prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]);

  const submit = async (e) => {
    e.preventDefault();
    if (value === "ada_komplain") {
      if (jenis.length === 0) { setError("Pilih minimal 1 jenis komplain."); return; }
      if (kategori.length === 0) { setError("Pilih minimal 1 kategori komplain."); return; }
    }
    setSubmitting(true); setError("");
    try {
      await onSubmit({
        accuracy: value,
        complaint_type: value === "ada_komplain" ? jenis : [],
        complaint_category: value === "ada_komplain" ? kategori : [],
        complaint_reason: value === "ada_komplain" ? ket.trim() : "",
      });
      onClose();
    } catch { setError("Gagal menyimpan. Silakan coba lagi."); }
    finally { setSubmitting(false); }
  };

  const inputClass = "mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";

  return <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Akurasi Pengiriman</DialogTitle>
        <DialogDescription>Pilih status akurasi untuk pengiriman ini.</DialogDescription>
      </DialogHeader>
      {outletName && <p className="rounded-xl bg-slate-50 px-4 py-2.5 text-sm text-slate-600">Outlet: <span className="font-semibold text-slate-900">{outletName}</span></p>}
      <form onSubmit={submit} className="space-y-4">
        <label className="text-sm font-medium">Status Akurasi
          <select value={value} onChange={(e) => setValue(e.target.value)} className={inputClass}>
            <option value="data_belum_tersedia">Data Belum Tersedia</option>
            <option value="tanpa_komplain">Tanpa Komplain</option>
            <option value="ada_komplain">Ada Komplain</option>
          </select>
        </label>
        {value === "ada_komplain" && <>
          <div>
            <p className="text-sm font-medium">Jenis Komplain <span className="text-slate-400">(boleh pilih lebih dari satu)</span></p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {JENIS_OPTIONS.map((o) => <Chip key={o.value} label={o.label} active={jenis.includes(o.value)} onClick={() => toggle(jenis, setJenis, o.value)} />)}
            </div>
          </div>
          <div>
            <p className="text-sm font-medium">Kategori Komplain <span className="text-slate-400">(boleh pilih lebih dari satu)</span></p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {KATEGORI_OPTIONS.map((o) => <Chip key={o.value} label={o.label} active={kategori.includes(o.value)} onClick={() => toggle(kategori, setKategori, o.value)} />)}
            </div>
          </div>
          <label className="text-sm font-medium">Keterangan
            <textarea value={ket} onChange={(e) => setKet(e.target.value)} rows={3} className={inputClass} placeholder="Tulis keterangan detail komplain..." />
          </label>
        </>}
        {error && <p className="flex items-center gap-1.5 text-sm text-red-600"><X className="h-4 w-4" />{error}</p>}
        <DialogFooter className="gap-2">
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold transition hover:bg-slate-50">Batal</button>
          <button type="submit" disabled={submitting} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60">{submitting && <Loader2 className="h-4 w-4 animate-spin" />}{submitting ? "Menyimpan..." : "Simpan"}</button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
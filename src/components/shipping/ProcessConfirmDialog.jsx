import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Upload } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { formatTonnage } from "./shippingUtils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function ProcessConfirmDialog({ open, onClose, onSubmit, title, description, outletName, fields = [] }) {
  const [values, setValues] = useState({});
  const [files, setFiles] = useState({});
  const [koliStatus, setKoliStatus] = useState("sesuai");
  const [tonnageStatus, setTonnageStatus] = useState("sesuai");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      const init = {};
      for (const f of fields) init[f.key] = f.type === "koli_verify" ? String(f.sourceValue ?? "") : (f.defaultValue != null ? String(f.defaultValue) : "");
      setValues(init);
      setFiles({});
      setKoliStatus("sesuai");
      setTonnageStatus("sesuai");
      setError("");
    }
  }, [open]);

  const submit = async (e) => {
    e.preventDefault();
    for (const f of fields) {
      if (f.type === "file") {
        if (!files[f.key]) { setError(`${f.helpText || f.label} wajib diunggah.`); return; }
      } else if (f.type === "koli_verify") {
        if (koliStatus === "tidak_sesuai") {
          const v = String(values[f.key] ?? "").trim();
          if (!v || Number(v) <= 0) { setError("Jumlah koli wajib diisi dan lebih dari 0."); return; }
        }
      } else if (f.type === "tonnage_verify") {
        if (tonnageStatus === "tidak_sesuai") {
          const v = String(values[f.key] ?? "").trim();
          if (!v || Number(v) <= 0) { setError("Tonase wajib diisi dan lebih dari 0."); return; }
        }
      } else if (f.type === "select_other") {
        const v = String(values[f.key] ?? "").trim();
        if (!v) { setError(`${f.label} wajib dipilih.`); return; }
        if (v === "lainnya") {
          const ot = String(values[`${f.key}_other`] ?? "").trim();
          if (!ot) { setError(`Penjelasan alasan wajib diisi.`); return; }
        }
      } else if (f.type === "readonly") {
        // display only, no validation
      } else {
        const v = String(values[f.key] ?? "").trim();
        if (!f.optional && !v) { setError(`${f.label} wajib diisi.`); return; }
        if (v && f.type === "number" && Number(v) <= 0) { setError(`${f.label} harus lebih dari 0.`); return; }
      }
    }
    setSubmitting(true); setError("");
    try {
      const payload = {};
      for (const f of fields) {
        if (f.type === "file") {
          const { file_url } = await base44.integrations.Core.UploadFile({ file: files[f.key] });
          payload[f.key] = file_url;
        } else if (f.type === "koli_verify") {
          payload[`${f.key}_status`] = koliStatus;
          payload[f.key] = koliStatus === "sesuai" ? Number(f.sourceValue) || 0 : Number(values[f.key]);
        } else if (f.type === "tonnage_verify") {
          payload.packing_tonnage_status = tonnageStatus;
          payload.tonnage = tonnageStatus === "sesuai" ? Number(f.sourceValue) || 0 : Number(values[f.key]);
        } else if (f.type === "select_other") {
          payload[f.key] = values[f.key] === "lainnya" ? String(values[`${f.key}_other`]).trim() : values[f.key];
        } else if (f.type === "readonly") {
          // display only, do not modify
        } else {
          payload[f.key] = f.type === "number" ? Number(values[f.key]) : values[f.key].trim();
        }
      }
      await onSubmit(payload);
      onClose();
    } catch { setError("Gagal menyimpan. Silakan coba lagi."); }
    finally { setSubmitting(false); }
  };

  const inputClass = "mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";

  return <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        {description && <DialogDescription>{description}</DialogDescription>}
      </DialogHeader>
      {outletName && <p className="rounded-xl bg-slate-50 px-4 py-2.5 text-sm text-slate-600">Outlet: <span className="font-semibold text-slate-900">{outletName}</span></p>}
      <form onSubmit={submit} className="space-y-4">
        {fields.map((f) => {
          if (f.type === "file") {
            return <div key={f.key} className="text-sm font-medium">
              {f.label}{f.helpText && <span className="block text-xs font-normal text-slate-500">Foto bertuliskan: {f.helpText}</span>}
              <div className="mt-1.5 flex items-center gap-3">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold transition hover:bg-slate-50">
                  <Upload className="h-4 w-4" />Pilih File
                  <input type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => setFiles((p) => ({ ...p, [f.key]: e.target.files?.[0] || null }))} />
                </label>
                <span className="text-sm text-slate-500">{files[f.key] ? files[f.key].name : "Belum ada file"}</span>
              </div>
            </div>;
          }
          if (f.type === "koli_verify") {
            return <div key={f.key}>
              <p className="text-sm font-medium">Jumlah Koli (dari Packing): <span className="font-bold text-slate-900">{f.sourceValue ?? 0}</span></p>
              <label className="mt-1.5 block text-sm font-medium">Verifikasi Jumlah Koli
                <Select value={koliStatus} onValueChange={setKoliStatus}>
                  <SelectTrigger className={inputClass}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sesuai">Jumlah Koli Sesuai</SelectItem>
                    <SelectItem value="tidak_sesuai">Jumlah Koli Tidak Sesuai</SelectItem>
                  </SelectContent>
                </Select>
              </label>
              {koliStatus === "tidak_sesuai" && <label className="mt-2 block text-sm font-medium">Update Jumlah Koli
                <input type="number" min="1" value={values[f.key] ?? ""} onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))} className={inputClass} placeholder={String(f.sourceValue ?? 0)} />
              </label>}
            </div>;
          }
          if (f.type === "tonnage_verify") {
            return <div key={f.key}>
              <p className="text-sm font-medium">Total Tonase DO (dari input): <span className="font-bold text-slate-900">{formatTonnage(f.sourceValue)}</span></p>
              <label className="mt-1.5 block text-sm font-medium">Verifikasi Tonase
                <Select value={tonnageStatus} onValueChange={setTonnageStatus}>
                  <SelectTrigger className={inputClass}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sesuai">Tonase Sesuai</SelectItem>
                    <SelectItem value="tidak_sesuai">Tonase Tidak Sesuai</SelectItem>
                  </SelectContent>
                </Select>
              </label>
              {tonnageStatus === "tidak_sesuai" && <label className="mt-2 block text-sm font-medium">Update Tonase (kg)
                <input type="number" min="1" value={values[f.key] ?? ""} onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))} className={inputClass} placeholder={String(f.sourceValue ?? 0)} />
              </label>}
            </div>;
          }
          if (f.type === "select_other") {
            return <div key={f.key}>
              <label className="block text-sm font-medium">{f.label}
                <Select value={values[f.key] ?? ""} onValueChange={(v) => setValues((s) => ({ ...s, [f.key]: v }))}>
                  <SelectTrigger className={inputClass}><SelectValue placeholder="Pilih alasan" /></SelectTrigger>
                  <SelectContent>
                    {f.options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </label>
              {values[f.key] === "lainnya" && <label className="mt-2 block text-sm font-medium">Penjelasan Lainnya
                <textarea value={values[`${f.key}_other`] ?? ""} onChange={(e) => setValues((v) => ({ ...v, [`${f.key}_other`]: e.target.value }))} rows={2} className={inputClass} placeholder="Jelaskan alasan..." />
              </label>}
            </div>;
          }
          if (f.type === "readonly") {
            return <div key={f.key} className="rounded-xl bg-slate-50 px-4 py-2.5 text-sm text-slate-600">{f.label}: <span className="font-bold text-slate-900">{formatTonnage(f.sourceValue)}</span></div>;
          }
          return <label key={f.key} className="text-sm font-medium block">{f.label}
            {f.type === "textarea"
              ? <textarea value={values[f.key] ?? ""} onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))} rows={3} className={inputClass} placeholder={f.placeholder || ""} />
              : <input type={f.type || "text"} value={values[f.key] ?? ""} onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))} className={inputClass} placeholder={f.placeholder || ""} />}
          </label>;
        })}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <DialogFooter className="gap-2">
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold transition hover:bg-slate-50">Batal</button>
          <button type="submit" disabled={submitting} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60">{submitting && <Loader2 className="h-4 w-4 animate-spin" />}{submitting ? "Menyimpan..." : "Simpan"}</button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
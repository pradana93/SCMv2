import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Upload, RotateCcw } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { formatTonnage } from "./shippingUtils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Drafts survive a page reload (camera app killing the tab, session expiry,
// accidental refresh): values + already-uploaded photo URLs are restored.
const DRAFT_TTL_MS = 7 * 24 * 3600 * 1000;
const draftStorageKey = (draftKey) => `scm_form_draft:${draftKey}`;
function loadDraft(draftKey) {
  if (!draftKey) return null;
  try {
    const raw = localStorage.getItem(draftStorageKey(draftKey));
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (!d || Date.now() - (d.savedAt || 0) > DRAFT_TTL_MS) return null;
    return d;
  } catch {
    return null;
  }
}
function saveDraft(draftKey, draft) {
  if (!draftKey) return;
  try {
    localStorage.setItem(draftStorageKey(draftKey), JSON.stringify({ ...draft, savedAt: Date.now() }));
  } catch {
    // storage full/blocked — form still works in memory
  }
}
function clearDraft(draftKey) {
  if (!draftKey) return;
  try {
    localStorage.removeItem(draftStorageKey(draftKey));
  } catch {
    // ignore
  }
}

export default function ProcessConfirmDialog({ open, onClose, onSubmit, title, description, outletName, fields = [], draftKey = "" }) {
  const [values, setValues] = useState({});
  const [files, setFiles] = useState({});
  const [fileNames, setFileNames] = useState({});
  const [uploads, setUploads] = useState({});
  const [koliStatus, setKoliStatus] = useState("sesuai");
  const [tonnageStatus, setTonnageStatus] = useState("sesuai");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const inflight = useRef({});

  useEffect(() => {
    if (open) {
      const init = {};
      for (const f of fields) init[f.key] = f.type === "koli_verify" ? String(f.sourceValue ?? "") : (f.defaultValue != null ? String(f.defaultValue) : "");
      let restored = null;
      try {
        restored = loadDraft(draftKey);
      } catch {
        restored = null;
      }
      setValues(restored && restored.values ? { ...init, ...restored.values } : init);
      setKoliStatus((restored && restored.koliStatus) || "sesuai");
      setTonnageStatus((restored && restored.tonnageStatus) || "sesuai");
      setFiles({});
      setFileNames((restored && restored.fileNames) || {});
      const doneUploads = {};
      for (const [k, url] of Object.entries((restored && restored.fileUrls) || {})) {
        if (url) doneUploads[k] = { status: "done", url };
      }
      setUploads(doneUploads);
      setError("");
    }
  }, [open]);

  // Autosave draft while the dialog is open
  useEffect(() => {
    if (!open || !draftKey) return;
    const fileUrls = {};
    for (const [k, u] of Object.entries(uploads)) {
      if (u && u.status === "done" && u.url) fileUrls[k] = u.url;
    }
    saveDraft(draftKey, { values, koliStatus, tonnageStatus, fileUrls, fileNames });
  }, [open, draftKey, values, koliStatus, tonnageStatus, uploads, fileNames]);

  const uploadFile = async (key, file) => {
    if (!file) return null;
    // De-dupe concurrent uploads of the same field
    if (inflight.current[key]) {
      try {
        return await inflight.current[key];
      } catch {
        return null;
      }
    }
    const p = (async () => {
      setUploads((u) => ({ ...u, [key]: { status: "uploading" } }));
      try {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        setUploads((u) => ({ ...u, [key]: { status: "done", url: file_url } }));
        return file_url;
      } catch (e) {
        setUploads((u) => ({ ...u, [key]: { status: "error", error: (e && e.message) || "Upload gagal" } }));
        return null;
      } finally {
        delete inflight.current[key];
      }
    })();
    inflight.current[key] = p;
    return p;
  };

  const handleFileSelect = (key, file) => {
    if (!file) return;
    setFiles((prev) => ({ ...prev, [key]: file }));
    setFileNames((prev) => ({ ...prev, [key]: file.name }));
    setError("");
    uploadFile(key, file);
  };

  const submit = async (e) => {
    e.preventDefault();
    // Wait for any in-progress photo uploads before validating
    const pending = Object.keys(inflight.current);
    if (pending.length) {
      setError("Menunggu upload foto selesai...");
      try {
        await Promise.all(Object.values(inflight.current).map((p) => p.catch(() => null)));
      } catch {
        // fall through to validation below
      }
    }
    for (const f of fields) {
      if (f.type === "file") {
        let url = uploads[f.key] && uploads[f.key].url;
        if (!url && files[f.key]) {
          // Fallback: file was picked but never uploaded (e.g. offline at pick time)
          setError("Mengunggah foto...");
          url = await uploadFile(f.key, files[f.key]);
        }
        if (!url) {
          const failed = uploads[f.key] && uploads[f.key].status === "error";
          setError(failed ? `Upload ${f.helpText || f.label} gagal. Ketuk Coba Lagi.` : `${f.helpText || f.label} wajib diunggah.`);
          return;
        }
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
          payload[f.key] = uploads[f.key].url;
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
      clearDraft(draftKey);
      onClose();
    } catch { setError("Gagal menyimpan. Silakan coba lagi."); }
    finally { setSubmitting(false); }
  };

  const inputClass = "mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";

  const renderFileField = (f) => {
    const up = uploads[f.key] || { status: "idle" };
    const displayName = (files[f.key] && files[f.key].name) || fileNames[f.key] || "";
    return (
      <div key={f.key} className="text-sm font-medium">
        {f.label}{f.helpText && <span className="block text-xs font-normal text-slate-500">Foto bertuliskan: {f.helpText}</span>}
        <div className="mt-1.5 flex items-center gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold transition hover:bg-slate-50">
            <Upload className="h-4 w-4" />Pilih File
            <input type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => handleFileSelect(f.key, e.target.files?.[0] || null)} />
          </label>
          <span className="text-sm text-slate-500">
            {up.status === "uploading" && <span className="inline-flex items-center gap-1.5"><Loader2 className="h-4 w-4 animate-spin" />Mengunggah...</span>}
            {up.status === "done" && <span className="text-emerald-600">Terunggah{displayName ? `: ${displayName}` : ""}</span>}
            {up.status === "error" && <span className="text-red-600">Upload gagal{displayName ? `: ${displayName}` : ""}</span>}
            {up.status !== "uploading" && up.status !== "done" && up.status !== "error" && (displayName || "Belum ada file")}
          </span>
        </div>
        {up.status === "error" && (
          <button type="button" onClick={() => files[f.key] && uploadFile(f.key, files[f.key])} className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50">
            <RotateCcw className="h-3.5 w-3.5" />Coba Lagi
          </button>
        )}
      </div>
    );
  };

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
            return renderFileField(f);
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

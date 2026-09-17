import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Clock, Upload, FileText, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";

const inputClass = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";

export default function ActualArrivalDialog({ open, item, onClose, onCommit }) {
  const { user } = useAuth();
  const [date, setDate] = useState("");
  const [confirmedBy, setConfirmedBy] = useState("");
  const [proofFile, setProofFile] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && item) {
      setDate(item.actual_arrival_date || new Date().toISOString().slice(0, 10));
      setConfirmedBy(user?.display_name || user?.full_name || user?.email || "");
      setProofFile(null);
    }
  }, [open, item?.id]);

  const timeStr = new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

  const submit = async () => {
    if (!date) return;
    setSaving(true);
    try {
      let proofUrl = item.proof_file_url || "";
      if (proofFile) {
        try { const res = await base44.integrations.Core.UploadFile({ file: proofFile }); proofUrl = res.file_url; } catch {}
      }
      await onCommit({
        actual_arrival_date: date,
        arrival_timestamp: new Date().toISOString(),
        arrival_confirmed_by: confirmedBy.trim(),
        proof_file_url: proofUrl,
      });
      onClose();
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Konfirmasi Aktual Tiba</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-slate-500">Konfirmasi kedatangan barang untuk <b>{item?.outlet_name || "-"}</b>.</p>
          <label className="block text-sm font-medium">Tanggal Tiba
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`mt-1.5 ${inputClass}`} />
          </label>
          <div className="rounded-xl bg-slate-50 px-3 py-2.5">
            <p className="flex items-center gap-1.5 text-xs font-medium text-slate-600"><Clock className="h-3.5 w-3.5" />Jam Pengisian: <span className="font-semibold text-slate-800">{timeStr}</span> <span className="text-slate-400">(otomatis)</span></p>
          </div>
          <label className="block text-sm font-medium">Dikonfirmasi Oleh
            <input value={confirmedBy} onChange={(e) => setConfirmedBy(e.target.value)} className={`mt-1.5 ${inputClass}`} placeholder="Nama staf logistik / driver" />
            <span className="mt-1 block text-[11px] text-slate-400">Diisi oleh staf logistik atau driver</span>
          </label>
          <div>
            <p className="text-sm font-medium">Upload Bukti Barang Tiba (opsional)</p>
            <p className="mb-2 text-[11px] text-slate-400">Foto bukti DO sudah tiba di lokasi. Dapat dikosongkan.</p>
            {proofFile ? (
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <FileText className="h-4 w-4 text-slate-500" />
                <span className="flex-1 truncate text-sm text-slate-700">{proofFile.name}</span>
                <button onClick={() => setProofFile(null)} className="rounded p-1 text-red-500 hover:bg-red-50"><X className="h-3.5 w-3.5" /></button>
              </div>
            ) : (
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">
                <Upload className="h-3.5 w-3.5" />Pilih File
                <input type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => setProofFile(e.target.files?.[0] || null)} />
              </label>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Batal</Button>
          <Button onClick={submit} disabled={saving || !date} className="bg-emerald-600 text-white hover:bg-emerald-700">{saving ? "Menyimpan..." : "Konfirmasi"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
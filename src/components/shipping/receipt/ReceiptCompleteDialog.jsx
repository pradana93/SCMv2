import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const inputClass = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";

export default function ReceiptCompleteDialog({ open, onClose, onSave, record, busy }) {
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!open) return;
    setNote("Tidak sesuai rencana kedatangan");
  }, [open, record]);

  const submit = () => onSave({ id: record.id, status: "ditutup", complete_note: note.trim() });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Tutup Verifikasi</DialogTitle></DialogHeader>
        <p className="-mt-2 text-xs text-slate-500">{record?.verified_by || "-"}</p>
        <div className="space-y-3">
          <label className="block text-sm font-medium">Catatan Penyelesaian<input value={note} onChange={(e) => setNote(e.target.value)} className={`mt-1.5 ${inputClass}`} /></label>
          <p className="text-xs text-slate-400">Verifikasi akan ditutup dengan catatan ini.</p>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Batal</Button><Button onClick={submit} disabled={busy || !note.trim()}>{busy ? "Menyimpan..." : "Selesaikan"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
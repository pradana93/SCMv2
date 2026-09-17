import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const inputClass = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";
const today = () => new Date().toISOString().slice(0, 10);

export default function ProductionPlanDialog({ open, onClose, onSave, editing, fromRequest, busy }) {
  const [planDate, setPlanDate] = useState(today());
  const [qty, setQty] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setPlanDate(editing.plan_date || today());
      setQty(String(editing.planned_quantity ?? ""));
      setNote(editing.note || "");
    } else {
      setPlanDate(today()); setQty(""); setNote("");
    }
  }, [open, editing]);

  const itemName = fromRequest?.item_name || editing?.item_name || "";
  const unit = fromRequest?.unit || editing?.unit || "";
  const warehouse = fromRequest?.warehouse || editing?.warehouse || "";
  const requestedQty = fromRequest?.requested_quantity || 0;

  const submit = () => {
    if (!planDate || !qty) return;
    const payload = {
      plan_date: planDate,
      item_name: itemName,
      unit,
      warehouse,
      planned_quantity: Number(qty) || 0,
      note: note.trim(),
      status: editing?.status || "menunggu_proses",
    };
    if (editing) payload.id = editing.id;
    if (fromRequest) payload.request_id = fromRequest.id;
    onSave(payload);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{editing ? "Edit Rencana Produksi" : "Buat Rencana Produksi"}</DialogTitle></DialogHeader>
        <p className="-mt-2 text-xs text-slate-500">Dari permintaan: {itemName} · {warehouse}</p>
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs">
            <div><p className="text-slate-400">Nama Barang</p><p className="text-sm font-bold text-slate-800">{itemName || "-"}</p></div>
            <div><p className="text-slate-400">Kuantitas Diminta</p><p className="text-sm font-bold text-slate-800">{Number(requestedQty).toLocaleString("id-ID")} <span className="text-xs font-normal text-slate-400">{unit || ""}</span></p></div>
            <div><p className="text-slate-400">Satuan</p><p className="text-sm font-bold text-slate-800">{unit || "-"}</p></div>
          </div>
          <label className="block text-sm font-medium">Tanggal Rencana Produksi<input type="date" value={planDate} onChange={(e) => setPlanDate(e.target.value)} className={`mt-1.5 ${inputClass}`} /></label>
          <label className="block text-sm font-medium">Kuantitas Rencana Produksi<input type="number" min="0" value={qty} onChange={(e) => setQty(e.target.value)} className={`mt-1.5 ${inputClass}`} placeholder="0" /></label>
          <label className="block text-sm font-medium">Catatan<input value={note} onChange={(e) => setNote(e.target.value)} className={`mt-1.5 ${inputClass}`} placeholder="Catatan (opsional)" /></label>
          <p className="text-xs text-slate-400">Setelah disimpan, muncul di daftar Proses Produksi dengan status "Menunggu Proses Produksi".</p>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Batal</Button><Button onClick={submit} disabled={busy || !planDate || !qty}>{busy ? "Menyimpan..." : "Simpan"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
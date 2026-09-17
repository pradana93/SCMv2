import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const inputClass = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";
const today = () => new Date().toISOString().slice(0, 10);

export default function ProductionFinishDialog({ open, onClose, onSave, record, busy }) {
  const [actualDate, setActualDate] = useState(today());
  const [qty, setQty] = useState("");
  const [rejectQty, setRejectQty] = useState("");
  const [rejectUnit, setRejectUnit] = useState("");
  const [crew, setCrew] = useState("");
  const [pic, setPic] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!open) return;
    setActualDate(record?.actual_date || record?.plan_date || today());
    setQty(String(record?.actual_quantity ?? record?.round_quantity ?? ""));
    setRejectQty(String(record?.reject_quantity ?? ""));
    setRejectUnit(record?.reject_unit || record?.unit || "");
    setCrew(String(record?.crew_count ?? ""));
    setPic(record?.pic_name || "");
    setNote(record?.actual_note || "");
  }, [open, record]);

  const submit = () => {
    if (!actualDate || !qty || !pic.trim()) return;
    onSave({
      id: record.id,
      actual_date: actualDate,
      actual_quantity: Number(qty) || 0,
      reject_quantity: Number(rejectQty) || 0,
      reject_unit: rejectUnit.trim(),
      crew_count: Number(crew) || 0,
      pic_name: pic.trim(),
      actual_note: note.trim(),
      timestamp_end: new Date().toISOString(),
      status: "menunggu_verifikasi",
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Selesai Proses Produksi</DialogTitle></DialogHeader>
        <p className="-mt-2 text-xs text-slate-500">{record?.item_name} · {record?.warehouse || "-"}</p>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 px-3 py-2 text-xs">
            <div><p className="text-slate-400">Nama Barang</p><p className="text-sm font-bold text-slate-800">{record?.item_name || "-"}</p></div>
            <div><p className="text-slate-400">Satuan</p><p className="text-sm font-bold text-slate-800">{record?.unit || "-"}</p></div>
            <div className="col-span-2"><p className="text-slate-400">Kuantitas Shift Ini</p><p className="text-sm font-bold text-indigo-700">{Number(record?.round_quantity || 0).toLocaleString("id-ID")} {record?.unit || ""}</p></div>
          </div>
          <label className="block text-sm font-medium">Tanggal Aktual Produksi<input type="date" value={actualDate} onChange={(e) => setActualDate(e.target.value)} className={`mt-1.5 ${inputClass}`} /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm font-medium">Kuantitas Aktual<input type="number" min="0" value={qty} onChange={(e) => setQty(e.target.value)} className={`mt-1.5 ${inputClass}`} placeholder="0" /></label>
            <label className="text-sm font-medium">Satuan<input value={record?.unit || ""} readOnly className={`mt-1.5 ${inputClass} bg-slate-50 text-slate-500`} placeholder="-" /></label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm font-medium">Kuantitas Reject<input type="number" min="0" value={rejectQty} onChange={(e) => setRejectQty(e.target.value)} className={`mt-1.5 ${inputClass}`} placeholder="0" /></label>
            <label className="text-sm font-medium">Satuan Reject<input value={rejectUnit} onChange={(e) => setRejectUnit(e.target.value)} className={`mt-1.5 ${inputClass}`} placeholder="kg, gr, dll" /></label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm font-medium">Jumlah Crew<input type="number" min="0" value={crew} onChange={(e) => setCrew(e.target.value)} className={`mt-1.5 ${inputClass}`} placeholder="0" /></label>
            <label className="text-sm font-medium">Nama PIC Produksi<input value={pic} onChange={(e) => setPic(e.target.value)} className={`mt-1.5 ${inputClass}`} placeholder="Nama PIC" /></label>
          </div>
          <label className="block text-sm font-medium">Catatan<input value={note} onChange={(e) => setNote(e.target.value)} className={`mt-1.5 ${inputClass}`} placeholder="Catatan (opsional)" /></label>
          <p className="text-xs text-slate-400">Setelah disimpan, status menjadi "Menunggu Verifikasi". Stok belum masuk gudang.</p>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Batal</Button><Button onClick={submit} disabled={busy || !actualDate || !qty || !pic.trim()}>{busy ? "Menyimpan..." : "Selesai"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
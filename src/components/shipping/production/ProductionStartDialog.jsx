import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const inputClass = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";

const procStatus = (s) => ({ dalam_proses: "Dalam Proses", menunggu_verifikasi: "Menunggu Verifikasi", dalam_pembekuan: "Dalam Pembekuan", selesai: "Selesai" }[s] || s);

export default function ProductionStartDialog({ open, onClose, onSave, record, processes = [], busy }) {
  const [roundQty, setRoundQty] = useState("");
  const [crew, setCrew] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!open) return;
    const allocated = (processes || []).reduce((s, p) => s + (Number(p.round_quantity) || 0), 0);
    const remaining = Math.max(0, Number(record?.planned_quantity || 0) - allocated);
    setRoundQty(String(remaining || ""));
    setCrew(String(record?.crew_count ?? ""));
    setNote(record?.note || "");
  }, [open, record, processes]);

  const allocated = (processes || []).reduce((s, p) => s + (Number(p.round_quantity) || 0), 0);
  const accumActual = (processes || []).filter((p) => p.status === "selesai").reduce((s, p) => s + (Number(p.actual_quantity) || 0), 0);
  const remaining = Math.max(0, Number(record?.planned_quantity || 0) - allocated);

  const submit = () => {
    if (!crew || !roundQty) return;
    onSave({
      id: record.id,
      crew_count: Number(crew) || 0,
      round_quantity: Number(roundQty) || 0,
      note: note.trim(),
      status: "dalam_proses",
      timestamp_start: new Date().toISOString(),
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Mulai Proses Produksi</DialogTitle></DialogHeader>
        <p className="-mt-2 text-xs text-slate-500">{record?.item_name} · {record?.warehouse || "-"}</p>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 px-3 py-2 text-xs">
            <div><p className="text-slate-400">Nama Barang</p><p className="text-sm font-bold text-slate-800">{record?.item_name || "-"}</p></div>
            <div><p className="text-slate-400">Satuan</p><p className="text-sm font-bold text-slate-800">{record?.unit || "-"}</p></div>
            <div><p className="text-slate-400">Kuantitas Rencana Produksi</p><p className="text-sm font-bold text-slate-800">{Number(record?.planned_quantity || 0).toLocaleString("id-ID")} {record?.unit || ""}</p></div>
            <div><p className="text-slate-400">Sudah Dialokasikan</p><p className="text-sm font-bold text-indigo-700">{allocated.toLocaleString("id-ID")} {record?.unit || ""}</p></div>
            {accumActual > 0 && <div><p className="text-slate-400">Sudah Selesai</p><p className="text-sm font-bold text-emerald-700">{accumActual.toLocaleString("id-ID")} {record?.unit || ""}</p></div>}
            {remaining > 0 && <div className="col-span-2"><p className="text-slate-400">Sisa Kekurangan</p><p className="text-sm font-bold text-indigo-700">{remaining.toLocaleString("id-ID")} {record?.unit || ""}</p></div>}
          </div>
          {(processes || []).length > 0 && (
            <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-2.5">
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Proses Sebelumnya ({processes.length})</p>
              <div className="space-y-1">
                {processes.map((p, i) => (
                  <div key={p.id} className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-slate-500">Proses {i + 1}</span>
                    <span className="font-semibold text-slate-700">{Number(p.round_quantity || 0).toLocaleString("id-ID")} {record?.unit || ""} · {procStatus(p.status)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <label className="block text-sm font-medium">Kuantitas Proses Shift Ini<input type="number" min="0" max={remaining} value={roundQty} onChange={(e) => setRoundQty(e.target.value)} className={`mt-1.5 ${inputClass}`} placeholder="0" /></label>
          <label className="block text-sm font-medium">Jumlah Crew<input type="number" min="0" value={crew} onChange={(e) => setCrew(e.target.value)} className={`mt-1.5 ${inputClass}`} placeholder="0" /></label>
          <label className="block text-sm font-medium">Keterangan<input value={note} onChange={(e) => setNote(e.target.value)} className={`mt-1.5 ${inputClass}`} placeholder="Contoh: material yang diambil, shift, dll" /></label>
          <p className="text-xs text-slate-400">Setelah diklik, timer akan berjalan dengan format HH:MM:SS.</p>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Batal</Button><Button onClick={submit} disabled={busy || !crew || !roundQty}>{busy ? "Menyimpan..." : "Mulai Proses"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Snowflake, Warehouse } from "lucide-react";

const inputClass = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";

export default function ProductionVerifyDialog({ open, onClose, onSave, record, busy }) {
  const [choice, setChoice] = useState("");
  const [actualQty, setActualQty] = useState("");

  useEffect(() => {
    if (!open) return;
    setChoice("");
    setActualQty(String(record?.actual_quantity ?? record?.planned_quantity ?? ""));
  }, [open, record]);

  const submit = () => {
    if (choice === "pembekuan") {
      if (!actualQty) return;
      onSave({
        id: record.id,
        choice: "pembekuan",
        freezing_actual_quantity: Number(actualQty) || 0,
        freezing_start_ts: new Date().toISOString(),
        status: "dalam_pembekuan",
      });
    } else if (choice === "penyimpanan") {
      onSave({ id: record.id, choice: "penyimpanan", status: "selesai" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Verifikasi Hasil Produksi</DialogTitle></DialogHeader>
        <p className="-mt-2 text-xs text-slate-500">{record?.item_name} · {record?.warehouse || "-"}</p>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 px-3 py-2 text-xs">
            <div><p className="text-slate-400">Nama Barang</p><p className="text-sm font-bold text-slate-800">{record?.item_name || "-"}</p></div>
            <div><p className="text-slate-400">Satuan</p><p className="text-sm font-bold text-slate-800">{record?.unit || "-"}</p></div>
          </div>
          <p className="text-sm font-medium">Pilih langkah selanjutnya:</p>
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => setChoice("pembekuan")} className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition ${choice === "pembekuan" ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:bg-slate-50"}`}>
              <Snowflake className="h-6 w-6 text-blue-600" /><span className="text-sm font-semibold text-slate-700">Proses Pembekuan</span>
            </button>
            <button type="button" onClick={() => setChoice("penyimpanan")} className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition ${choice === "penyimpanan" ? "border-emerald-500 bg-emerald-50" : "border-slate-200 hover:bg-slate-50"}`}>
              <Warehouse className="h-6 w-6 text-emerald-600" /><span className="text-sm font-semibold text-slate-700">Masuk Penyimpanan</span>
            </button>
          </div>
          {choice === "pembekuan" && (
            <label className="block text-sm font-medium">Kuantitas Aktual untuk Pembekuan<input type="number" min="0" value={actualQty} onChange={(e) => setActualQty(e.target.value)} className={`mt-1.5 ${inputClass}`} placeholder="0" /></label>
          )}
          {choice === "pembekuan" && <p className="text-xs text-slate-400">Setelah disimpan, timer pembekuan berjalan (HH:MM:SS). Stok belum masuk sampai pembekuan selesai.</p>}
          {choice === "penyimpanan" && <p className="text-xs text-slate-400">Stok akan otomatis masuk ke gudang <span className="font-semibold">{record?.warehouse || "-"}</span>.</p>}
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Batal</Button><Button onClick={submit} disabled={busy || !choice || (choice === "pembekuan" && !actualQty)}>{busy ? "Menyimpan..." : "Simpan"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
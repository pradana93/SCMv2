import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ShieldCheck } from "lucide-react";
import { useStockCurrent } from "@/components/shipping/useStockCurrent";

const inputClass = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";
const today = () => new Date().toISOString().slice(0, 10);

export default function ReceiptVerifyDialog({ open, onClose, onSave, record, busy, currentUser }) {
  const [verifyDate, setVerifyDate] = useState(today());
  const [verifier, setVerifier] = useState("");
  const [rows, setRows] = useState([]);
  const { calcItemTonnage, gramasiFor } = useStockCurrent();

  useEffect(() => {
    if (!open) return;
    setVerifyDate(today());
    setVerifier(currentUser?.full_name || currentUser?.email || "");
    setRows((Array.isArray(record?.received_items) ? record.received_items : []).map((it) => {
      const hasGramasi = gramasiFor(it.item_name) > 0;
      const calcT = calcItemTonnage(it);
      return {
        item_name: it.item_name || "",
        quantity: String(it.quantity ?? ""),
        unit: it.unit || "",
        tonnage: hasGramasi ? String(calcT) : String(it.tonnage ?? ""),
        note: it.note || "",
        _autoTonnage: hasGramasi,
      };
    }));
  }, [open, record, currentUser]);

  const setRow = (i, field, value) => setRows((p) => p.map((r, idx) => {
    if (idx !== i) return r;
    const next = { ...r, [field]: value };
    if (r._autoTonnage && field === "quantity") {
      next.tonnage = String(calcItemTonnage({ item_name: r.item_name, quantity: Number(value) || 0, unit: r.unit }));
    }
    return next;
  }));

  const submit = () => {
    if (!verifyDate || !verifier.trim()) return;
    onSave({
      id: record.id,
      verified_date: verifyDate,
      verified_by: verifier.trim(),
      received_items: rows.map((r) => ({
        item_name: r.item_name, quantity: Number(r.quantity) || 0, unit: r.unit.trim(),
        tonnage: Number(r.tonnage) || 0, note: r.note.trim(),
      })),
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-emerald-600" />Lakukan Verifikasi</DialogTitle>
        </DialogHeader>
        <p className="-mt-2 text-xs text-slate-500">{record?.sender_name || "-"} · {record?.warehouse || "-"}</p>
        <div className="space-y-3">
          {record?.surat_jalan_url && (
            <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">Bukti Surat Jalan: <a href={record.surat_jalan_url} target="_blank" rel="noreferrer" className="font-semibold text-indigo-600 underline">Lihat file</a></div>
          )}
          <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 px-3 py-2 text-xs">
            <div><p className="text-slate-400">Stock Keeper</p><p className="text-sm font-bold text-slate-800">{record?.stock_keeper_name || "-"}</p></div>
            <div><p className="text-slate-400">Jumlah Crew</p><p className="text-sm font-bold text-slate-800">{record?.crew_count || 0}</p></div>
          </div>
          <div>
            <p className="mb-1.5 text-sm font-medium">Barang yang Diverifikasi <span className="text-[11px] text-slate-400">(kuantitas dapat diubah sesuai aktual)</span></p>
            <div className="space-y-2">
              {rows.map((r, i) => (
                <div key={i} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-slate-800">{r.item_name}</p>
                    {Number(r.tonnage) > 0 && <span className="text-xs font-semibold text-slate-500">{Number(r.tonnage).toLocaleString("id-ID")} kg{r._autoTonnage && " (auto)"}</span>}
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <label className="text-xs font-medium">Kuantitas Aktual<input type="number" min="0" value={r.quantity} onChange={(e) => setRow(i, "quantity", e.target.value)} className={`mt-1 ${inputClass}`} placeholder="0" /></label>
                    <label className="text-xs font-medium">Satuan<input value={r.unit} readOnly className={`mt-1 ${inputClass} bg-slate-50 text-slate-500`} placeholder="-" /></label>
                  </div>
                  {r.note && <p className="mt-1 text-xs text-slate-400">{r.note}</p>}
                </div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm font-medium">Tanggal Verifikasi<input type="date" value={verifyDate} onChange={(e) => setVerifyDate(e.target.value)} className={`mt-1.5 ${inputClass}`} /></label>
            <label className="block text-sm font-medium">Diverifikasi oleh<input value={verifier} readOnly className={`mt-1.5 ${inputClass} bg-slate-50 text-slate-500`} /></label>
          </div>
          <p className="text-xs text-slate-400">Setelah verifikasi, stok masuk ke gudang <span className="font-semibold">{record?.warehouse || "-"}</span>. Jika masih ada kekurangan, rencana kedatangan tetap muncul di daftar.</p>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Batal</Button><Button onClick={submit} disabled={busy || !verifyDate || !verifier.trim()}>{busy ? "Menyimpan..." : "Verifikasi & Selesai"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
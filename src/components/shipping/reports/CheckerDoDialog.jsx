import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatTonnage } from "../shippingUtils";

export default function CheckerDoDialog({ checker, shipments, onClose }) {
  const open = !!checker;
  const list = checker ? (shipments || []).filter((s) => s.status === "sudah_dikirim" && ((s.checker_name || "").trim() || "(tanpa checker)") === checker) : [];
  const totalTonnage = list.reduce((sum, s) => sum + Number(s.tonnage || 0), 0);
  return <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
    <DialogContent className="sm:max-w-2xl">
      <DialogHeader><DialogTitle>Rincian DO — {checker}</DialogTitle></DialogHeader>
      <p className="text-sm text-slate-500">{list.length} DO dikerjakan oleh {checker} · Total tonase {formatTonnage(totalTonnage)}</p>
      <div className="mt-2 max-h-96 overflow-auto rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
            <tr><th className="px-4 py-3">Tanggal</th><th className="px-4 py-3">Tujuan</th><th className="px-4 py-3">DO No</th><th className="px-4 py-3 text-right">Tonase</th><th className="px-4 py-3 text-right">Crew</th><th className="px-4 py-3">Akurasi</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {!list.length ? <tr><td className="px-4 py-6 text-center text-slate-400" colSpan={6}>Tidak ada DO.</td></tr> :
              list.map((s) => <tr key={s.id}><td className="px-4 py-3 text-slate-600">{s.delivery_date}</td><td className="px-4 py-3 font-medium">{s.outlet_name}</td><td className="px-4 py-3 text-slate-600">{s.do_number || "-"}</td><td className="px-4 py-3 text-right text-slate-600">{formatTonnage(s.tonnage)}</td><td className="px-4 py-3 text-right text-slate-600">{Number(s.crew_count || 0)}</td><td className="px-4 py-3">{s.accuracy === "ada_komplain" ? <span className="inline-flex rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700">Ada Komplain</span> : s.accuracy === "tanpa_komplain" ? <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">Tanpa Komplain</span> : <span className="text-xs text-slate-400">-</span>}</td></tr>)}
          </tbody>
        </table>
      </div>
    </DialogContent>
  </Dialog>;
}
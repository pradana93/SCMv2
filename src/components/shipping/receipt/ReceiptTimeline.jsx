import { formatTimestamp } from "@/components/shipping/shippingUtils";

const STATUS_LABELS = {
  rencana: "Pending",
  dalam_proses: "Dalam Proses Penerimaan",
  menunggu_verifikasi: "Menunggu Verifikasi",
  diterima: "Selesai",
  ditutup: "Ditutup",
};

export default function ReceiptTimeline({ record }) {
  const history = Array.isArray(record?.status_history) ? record.status_history : [];
  const rounds = Array.isArray(record?.receive_rounds) ? record.receive_rounds : [];

  if (!history.length && !rounds.length) {
    return <div className="mt-2 rounded-lg border border-slate-100 bg-slate-50/60 p-2.5 text-xs text-slate-400">Belum ada riwayat status.</div>;
  }

  return (
    <div className="mt-2 rounded-lg border border-slate-100 bg-slate-50/60 p-2.5">
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Riwayat Status</p>
      <div className="space-y-1">
        {history.map((h, i) => (
          <div key={i} className="flex items-start gap-2 text-[11px]">
            <span className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${h.status === "diterima" ? "bg-emerald-500" : h.status === "ditutup" ? "bg-slate-500" : h.status === "menunggu_verifikasi" ? "bg-violet-500" : h.status === "dalam_proses" ? "bg-blue-500" : "bg-amber-400"}`} />
            <div className="min-w-0">
              <span className="font-semibold text-slate-700">{STATUS_LABELS[h.status] || h.status}</span>
              {h.note && <span className="text-slate-400"> · {h.note}</span>}
              <span className="ml-1 text-slate-400">{h.timestamp ? formatTimestamp(h.timestamp) : ""}</span>
              {h.by && <span className="ml-1 text-slate-400">· {h.by}</span>}
            </div>
          </div>
        ))}
      </div>
      {rounds.length > 1 && <p className="mt-1.5 text-[11px] text-indigo-600">{rounds.length}× putaran penerimaan</p>}
    </div>
  );
}
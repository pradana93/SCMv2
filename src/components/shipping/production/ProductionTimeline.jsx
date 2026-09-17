import { formatTimestamp, formatDuration } from "@/components/shipping/shippingUtils";

const STATUS_LABELS = {
  menunggu_proses: "Rencana Dibuat",
  dalam_proses: "Mulai Proses",
  menunggu_verifikasi: "Selesai Produksi",
  dalam_pembekuan: "Dalam Pembekuan",
  selesai: "Stok Masuk",
};

export default function ProductionTimeline({ record, reqMap }) {
  const req = record?.request_id && reqMap ? reqMap.get(record.request_id) : null;
  const history = Array.isArray(record?.status_history) ? record.status_history : [];

  const steps = [
    { label: "Permintaan", value: req?.request_date || record?.plan_date || "-", sub: req?.warehouse || record?.warehouse || "" },
    { label: "Mulai Proses", value: record?.timestamp_start ? formatTimestamp(record.timestamp_start) : "-", sub: record?.timestamp_start ? `Crew ${record.crew_count || 0}` : "Belum dimulai" },
    { label: "Selesai Produksi", value: record?.timestamp_end ? formatTimestamp(record.timestamp_end) : "-", sub: record?.actual_quantity != null ? `Aktual ${Number(record.actual_quantity).toLocaleString("id-ID")} ${record.unit || ""}` : "Belum selesai" },
  ];

  if (record?.freezing_start_ts) {
    steps.push({ label: "Pembekuan", value: formatTimestamp(record.freezing_start_ts), sub: record?.freezing_end_ts ? "Pembekuan selesai" : "Dalam pembekuan" });
  }
  if (record?.status === "selesai") {
    steps.push({ label: "Stok Masuk", value: record?.freezing_end_ts ? formatTimestamp(record.freezing_end_ts) : formatTimestamp(record.timestamp_end), sub: `Gudang ${record.warehouse || "-"}` });
  }

  const prodDur = record?.timestamp_start ? formatDuration(record.timestamp_start, record.timestamp_end) : null;
  const freezeDur = record?.freezing_start_ts ? formatDuration(record.freezing_start_ts, record.freezing_end_ts) : null;

  return (
    <div className="mt-2 rounded-lg border border-slate-100 bg-slate-50/60 p-2.5">
      {history.length > 0 && (
        <div className="mb-2 space-y-0.5">
          {history.map((h, i) => (
            <div key={i} className="flex items-start gap-1.5 text-[10px]">
              <span className={`mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full ${h.status === "selesai" ? "bg-emerald-500" : h.status === "dalam_pembekuan" ? "bg-cyan-500" : h.status === "menunggu_verifikasi" ? "bg-violet-500" : h.status === "dalam_proses" ? "bg-blue-500" : "bg-slate-300"}`} />
              <span className="font-semibold text-slate-600">{STATUS_LABELS[h.status] || h.status}</span>
              {h.note && <span className="text-slate-400">· {h.note}</span>}
              <span className="text-slate-400">{h.timestamp ? formatTimestamp(h.timestamp) : ""}</span>
            </div>
          ))}
        </div>
      )}
      <div className="grid grid-cols-3 gap-2 text-xs sm:grid-cols-4">
        {steps.map((s, i) => (
          <div key={i} className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{s.label}</p>
            <p className="mt-0.5 truncate font-semibold text-slate-700">{s.value}</p>
            {s.sub && <p className="truncate text-[10px] text-slate-400">{s.sub}</p>}
          </div>
        ))}
      </div>
      {prodDur && <p className="mt-1.5 text-[11px] text-blue-600">Durasi produksi: <span className="font-bold">{prodDur}</span></p>}
      {freezeDur && <p className="mt-0.5 text-[11px] text-cyan-600">Durasi pembekuan: <span className="font-bold">{freezeDur}</span></p>}
    </div>
  );
}
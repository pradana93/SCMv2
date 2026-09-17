import { useState } from "react";
import { Download } from "lucide-react";
import * as XLSX from "xlsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { accuracyMeta } from "../shippingUtils";

const JENIS_LABEL = { kurang_kirim: "Kurang Kirim", lebih_kirim: "Lebih Kirim", rusak_waste: "Rusak/Waste", salah_input: "Salah Input", lainnya: "Lainnya" };
const KATEGORI_LABEL = { human_error: "Human Error", barang_waste: "Barang Waste", lainnya: "Lainnya" };
const arrLabel = (v, map) => Array.isArray(v) ? (v.length ? v.map((x) => map[x] || x).join(", ") : "-") : (v ? (map[v] || v) : "-");

export default function ReportComplaint({ shipments }) {
  const [selected, setSelected] = useState(null);
  const list = (shipments || [])
    .filter((s) => s.status === "sudah_dikirim")
    .slice()
    .sort((a, b) => (a.delivery_date || "").localeCompare(b.delivery_date || ""));
  const accOf = (s) => s.accuracy || "data_belum_tersedia";

  const download = () => {
    const header = ["Tanggal", "DO Number", "Gudang Asal", "Outlet Tujuan", "Jenis Komplain", "Kategori Komplain", "Keterangan Komplain", "Status Akurasi"];
    const rows = list.map((s) => [
      s.delivery_date,
      s.do_number || "-",
      s.warehouse,
      s.outlet_name,
      arrLabel(s.complaint_type, JENIS_LABEL),
      arrLabel(s.complaint_category, KATEGORI_LABEL),
      s.complaint_reason || "-",
      accuracyMeta[accOf(s)]?.label || accOf(s),
    ]);
    const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
    ws["!cols"] = header.map(() => ({ wch: 20 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Rekap Akurasi DO");
    XLSX.writeFile(wb, "rekap-akurasi-do.xlsx", { bookType: "xlsx" });
  };

  const counts = list.reduce((acc, s) => { const a = accOf(s); acc[a] = (acc[a] || 0) + 1; return acc; }, {});

  return <div>
    <div className="mb-3 flex items-center justify-between">
      <p className="text-sm text-slate-500">{list.length} DO sudah dikirim · {counts.ada_komplain || 0} komplain · {counts.tanpa_komplain || 0} tanpa komplain · {counts.data_belum_tersedia || 0} data belum tersedia</p>
      <button onClick={download} disabled={!list.length} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"><Download className="h-4 w-4" />Download</button>
    </div>
    {list.length === 0 ? <p className="text-sm text-slate-400">Tidak ada DO dengan status Sudah Dikirim pada rentang ini.</p> :
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="overflow-auto max-h-[70vh]"><table className="w-full text-left text-sm">
        <thead className="sticky top-0 z-10 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 shadow-sm"><tr>
          <th className="px-4 py-3">Tanggal</th><th className="px-4 py-3">DO Number</th><th className="px-4 py-3">Gudang Asal</th><th className="px-4 py-3">Outlet Tujuan</th><th className="px-4 py-3">Jenis Komplain</th><th className="px-4 py-3">Kategori Komplain</th><th className="px-4 py-3">Keterangan Komplain</th><th className="px-4 py-3">Status Akurasi</th>
        </tr></thead>
        <tbody className="divide-y divide-slate-100">
          {list.map((s) => {
            const a = accOf(s);
            const meta = accuracyMeta[a] || accuracyMeta.data_belum_tersedia;
            return <tr key={s.id} onClick={() => setSelected(s)} className="cursor-pointer align-top transition hover:bg-indigo-50/60">
              <td className="px-4 py-3 text-slate-600">{s.delivery_date}</td>
              <td className="px-4 py-3 text-slate-600">{s.do_number || "-"}</td>
              <td className="px-4 py-3 text-slate-600">{s.warehouse}</td>
              <td className="px-4 py-3 font-semibold">{s.outlet_name}</td>
              <td className="px-4 py-3 text-slate-600">{arrLabel(s.complaint_type, JENIS_LABEL)}</td>
              <td className="px-4 py-3 text-slate-600">{arrLabel(s.complaint_category, KATEGORI_LABEL)}</td>
              <td className="px-4 py-3 text-slate-600 max-w-[200px] truncate" title={s.complaint_reason || ""}>{s.complaint_reason || "-"}</td>
              <td className="px-4 py-3"><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${meta.className}`}>{meta.label}</span></td>
            </tr>;
          })}
        </tbody>
      </table></div></div>}
    <Dialog open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Detail Akurasi DO</DialogTitle></DialogHeader>
        {selected && (() => {
          const a = accOf(selected);
          const meta = accuracyMeta[a] || accuracyMeta.data_belum_tersedia;
          return <div className="space-y-3 text-sm">
            <p className="rounded-xl bg-slate-50 px-4 py-2.5 text-slate-600">Outlet: <span className="font-semibold text-slate-900">{selected.outlet_name}</span></p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              <div><span className="text-slate-400">DO Number</span><p className="font-medium">{selected.do_number || "-"}</p></div>
              <div><span className="text-slate-400">Tanggal</span><p className="font-medium">{selected.delivery_date}</p></div>
              <div><span className="text-slate-400">Gudang</span><p className="font-medium">{selected.warehouse}</p></div>
              <div><span className="text-slate-400">Checker</span><p className="font-medium">{selected.checker_name || "-"}</p></div>
            </div>
            <div><span className="text-slate-400">Status Akurasi</span><p><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${meta.className}`}>{meta.label}</span></p></div>
            {a === "ada_komplain" && <>
              <div><span className="text-slate-400">Jenis Komplain</span><p className="font-medium">{arrLabel(selected.complaint_type, JENIS_LABEL)}</p></div>
              <div><span className="text-slate-400">Kategori Komplain</span><p className="font-medium">{arrLabel(selected.complaint_category, KATEGORI_LABEL)}</p></div>
              <div><span className="text-slate-400">Keterangan</span><p className="whitespace-pre-wrap font-medium">{selected.complaint_reason || "-"}</p></div>
            </>}
          </div>;
        })()}
      </DialogContent>
    </Dialog>
  </div>;
}
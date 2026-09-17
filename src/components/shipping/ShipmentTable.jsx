import { useState } from "react";
import { Truck, CircleCheck, ChevronDown, FileText, Printer } from "lucide-react";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { formatTonnage, formatTimestamp, statusMeta } from "./shippingUtils";
import DeliveredDialog from "./DeliveredDialog";
import { printSuratJalan } from "./printSuratJalan";

export default function ShipmentTable({ shipments, loading, onUpdate, onDeliver }) {
  const [activeId, setActiveId] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const hasActions = Boolean(onUpdate && onDeliver);
  const active = shipments.find((item) => item.id === activeId);

  const changeStatus = async (item, status) => {
    if (status === "sudah_dikirim") { setActiveId(item.id); return; }
    const ts = new Date().toISOString();
    const payload = status === "menunggu_antrian"
      ? { status, timestamp_proses_picking: null, timestamp_proses_packing: null, timestamp_proses_loading: null, timestamp_sudah_dikirim: null }
      : status === "proses_picking" ? { status, timestamp_proses_picking: ts }
      : status === "proses_packing" ? { status, timestamp_proses_packing: ts }
      : status === "proses_loading" ? { status, timestamp_proses_loading: ts }
      : { status };
    setBusyId(item.id);
    try { await onUpdate(item.id, payload); }
    finally { setBusyId(null); }
  };
  const submitDeliver = async ({ file, checker_name, crew_count }) => {
    const item = shipments.find((s) => s.id === activeId);
    if (!item) return;
    setBusyId(activeId);
    try { await onDeliver(item, { file, checker_name, crew_count }); }
    finally { setBusyId(null); }
  };

  if (loading) return <div className="flex justify-center py-16"><div className="h-7 w-7 animate-spin rounded-full border-4 border-indigo-100 border-t-indigo-600" /></div>;
  if (!shipments.length) return <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center"><Truck className="mx-auto mb-3 h-8 w-8 text-slate-300" /><p className="font-medium">Belum ada pengiriman pada tanggal ini</p></div>;

  return <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-5 py-4">Outlet Tujuan</th>
            <th className="px-5 py-4">Tonase</th>
            <th className="px-5 py-4">Status</th>
            <th className="px-5 py-4">Armada</th>
            <th className="px-5 py-4">Aksi</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {shipments.map((item) => {
            const meta = statusMeta[item.status] || statusMeta.menunggu_antrian;
            const isBusy = busyId === item.id;
            return <tr key={item.id} className="align-top hover:bg-slate-50/70">
              <td className="px-5 py-4">
                <p className="font-semibold">{item.outlet_name}</p>
                {hasActions && <div className="mt-1.5 flex flex-col gap-1 whitespace-nowrap text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1.5"><CircleCheck className="h-3.5 w-3.5 text-blue-500" />Picking: {formatTimestamp(item.timestamp_proses_picking)}</span>
                  <span className="inline-flex items-center gap-1.5"><CircleCheck className="h-3.5 w-3.5 text-violet-500" />Packing: {formatTimestamp(item.timestamp_proses_packing)}</span>
                  <span className="inline-flex items-center gap-1.5"><CircleCheck className="h-3.5 w-3.5 text-cyan-500" />Loading: {formatTimestamp(item.timestamp_proses_loading)}</span>
                  <span className="inline-flex items-center gap-1.5"><CircleCheck className="h-3.5 w-3.5 text-emerald-500" />Dikirim: {formatTimestamp(item.timestamp_sudah_dikirim)}</span>
                </div>}
              </td>
              <td className="px-5 py-4 text-slate-600">{formatTonnage(item.tonnage)}</td>
              <td className="px-5 py-4"><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${meta.className}`}>{meta.label}</span></td>
              <td className="px-5 py-4 text-slate-600">{item.fleet}</td>
              <td className="px-5 py-4">
                <div className="flex items-center gap-2">
                  <button onClick={() => printSuratJalan(item)} className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100">
                    <Printer className="h-3.5 w-3.5" />Surat Jalan
                  </button>
                  {hasActions && <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button disabled={isBusy} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-60">
                        Ubah Status<ChevronDown className="h-3.5 w-3.5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuItem onClick={() => changeStatus(item, "menunggu_antrian")}>Menunggu Antrian</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => changeStatus(item, "proses_picking")}>Proses Picking</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => changeStatus(item, "proses_packing")}>Proses Packing</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => changeStatus(item, "proses_loading")}>Proses Loading</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => changeStatus(item, "sudah_dikirim")}>Sudah Dikirim</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>}
                  {hasActions && item.status === "sudah_dikirim" && item.proof_file_url && <a href={item.proof_file_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"><FileText className="h-3.5 w-3.5" />Bukti</a>}
                </div>
              </td>
            </tr>;
          })}
        </tbody>
      </table>
    </div>
    <DeliveredDialog open={!!activeId} onClose={() => setActiveId(null)} onSubmit={submitDeliver} outletName={active?.outlet_name} />
  </div>;
}
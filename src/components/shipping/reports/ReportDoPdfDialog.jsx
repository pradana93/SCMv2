import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Download, Loader2 } from "lucide-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { formatTonnage, formatTimestamp, statusMeta } from "../shippingUtils";

export default function ReportDoPdfDialog({ shipment, onClose }) {
  const ref = useRef(null);
  const wmRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const open = !!shipment;
  const s = shipment || {};
  const meta = statusMeta[s.status] || statusMeta.menunggu_antrian;
  const items = Array.isArray(s.do_items) ? s.do_items : [];
  const isTransfer = s.document_type === "item_transfer";

  const download = async () => {
    if (!ref.current) return;
    setBusy(true);
    const wm = wmRef.current;
    if (wm) wm.style.opacity = "0";
    try {
      const canvas = await html2canvas(ref.current, { scale: 2, backgroundColor: "#ffffff", useCORS: true });
      const pdf = new jsPDF("p", "mm", "a4");
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const pxPerMm = canvas.width / pageW;
      const pageCanvasH = pageH * pxPerMm;
      let renderedH = 0;
      let page = 0;
      while (renderedH < canvas.height) {
        const sliceH = Math.min(pageCanvasH, canvas.height - renderedH);
        const tmp = document.createElement("canvas");
        tmp.width = canvas.width; tmp.height = sliceH;
        tmp.getContext("2d").drawImage(canvas, 0, renderedH, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
        if (page > 0) pdf.addPage();
        pdf.addImage(tmp.toDataURL("image/png"), "PNG", 0, 0, pageW, sliceH / pxPerMm);
        pdf.saveGraphicsState();
        pdf.setGState(new pdf.GState({ opacity: 0.14 }));
        pdf.setTextColor(37, 99, 235);
        pdf.setFontSize(70);
        pdf.text(meta.label, pageW / 2, pageH / 2, { align: "center", angle: 35 });
        pdf.restoreGraphicsState();
        renderedH += sliceH;
        page++;
      }
      pdf.save(`DO-${s.do_number || s.outlet_name || "document"}.pdf`);
    } catch (e) { console.error(e); }
    finally { if (wm) wm.style.opacity = ""; setBusy(false); }
  };

  return <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
    <DialogContent className="sm:max-w-4xl">
      <DialogHeader>
        <DialogTitle>Dokumen DO — {s.outlet_name}</DialogTitle>
      </DialogHeader>
      <div className="flex justify-end">
        <button onClick={download} disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}{busy ? "Menyiapkan..." : "Download PDF"}</button>
      </div>
      <div className="max-h-[68vh] overflow-auto rounded-xl border border-slate-200 bg-slate-100 p-4">
        <div ref={ref} className="relative mx-auto bg-white text-slate-900 shadow-md" style={{ width: "210mm", minHeight: "297mm", padding: "16mm" }}>
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
            <span ref={wmRef} className="select-none text-[120px] font-black uppercase tracking-widest" style={{ color: "rgba(37,99,235,0.13)", transform: "rotate(-30deg)" }}>{meta.label}</span>
          </div>
          <div className="relative">
            <div className="flex items-start justify-between border-b-2 border-slate-800 pb-4">
              <div>
                <h1 className="text-2xl font-bold uppercase">{isTransfer ? "Item Transfer" : "Delivery Order"}</h1>
                <p className="mt-1 text-sm text-slate-500">No. {s.do_number || "-"}</p>
              </div>
              <div className="text-right text-sm">
                <p className="text-slate-500">Tanggal Pengiriman</p>
                <p className="font-semibold">{s.delivery_date}</p>
                <p className="mt-1 text-slate-500">Status</p>
                <p className="font-semibold">{meta.label}</p>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
              <div><p className="text-slate-500">Gudang Asal</p><p className="font-semibold">{s.warehouse}</p></div>
              <div><p className="text-slate-500">Tujuan</p><p className="font-semibold">{s.outlet_name}</p></div>
              <div><p className="text-slate-500">Armada</p><p className="font-semibold">{s.fleet || "-"}</p></div>
              <div><p className="text-slate-500">Plat Mobil</p><p className="font-semibold">{s.license_plate || "-"}</p></div>
              <div><p className="text-slate-500">Tonase</p><p className="font-semibold">{formatTonnage(s.tonnage)}</p></div>
              <div><p className="text-slate-500">Checker</p><p className="font-semibold">{s.checker_name || "-"}</p></div>
            </div>
            <div className="mt-6">
              <p className="mb-2 text-sm font-semibold uppercase text-slate-600">Daftar Barang</p>
              <table className="w-full border-collapse text-sm">
                <thead><tr className="bg-slate-100 text-left">
                  <th className="border border-slate-300 px-2 py-1.5">No</th>
                  <th className="border border-slate-300 px-2 py-1.5">Kode</th>
                  <th className="border border-slate-300 px-2 py-1.5">Nama Barang</th>
                  <th className="border border-slate-300 px-2 py-1.5 text-right">Qty</th>
                  <th className="border border-slate-300 px-2 py-1.5">Satuan</th>
                  <th className="border border-slate-300 px-2 py-1.5">Koli</th>
                </tr></thead>
                <tbody>
                  {items.length === 0 ? <tr><td className="border border-slate-300 px-2 py-3 text-center text-slate-400" colSpan={6}>Tidak ada item</td></tr> :
                    items.map((it, i) => <tr key={i}>
                      <td className="border border-slate-300 px-2 py-1.5">{i + 1}</td>
                      <td className="border border-slate-300 px-2 py-1.5">{it.code || "-"}</td>
                      <td className="border border-slate-300 px-2 py-1.5">{it.name}</td>
                      <td className="border border-slate-300 px-2 py-1.5 text-right">{it.quantity}</td>
                      <td className="border border-slate-300 px-2 py-1.5">{it.unit || "-"}</td>
                      <td className="border border-slate-300 px-2 py-1.5">{it.koli || "-"}</td>
                    </tr>)}
                </tbody>
              </table>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-x-8 gap-y-1.5 text-xs text-slate-600">
              <div><span className="font-semibold text-slate-500">Picking:</span> {formatTimestamp(s.timestamp_proses_picking)} → {formatTimestamp(s.timestamp_proses_picking_end)}</div>
              <div><span className="font-semibold text-slate-500">Packing:</span> {formatTimestamp(s.timestamp_proses_packing)} → {formatTimestamp(s.timestamp_proses_packing_end)}</div>
              <div><span className="font-semibold text-slate-500">Loading:</span> {formatTimestamp(s.timestamp_proses_loading)} → {formatTimestamp(s.timestamp_proses_loading_end)}</div>
              <div><span className="font-semibold text-slate-500">Dikirim:</span> {formatTimestamp(s.timestamp_sudah_dikirim)}</div>
            </div>
            {s.accuracy === "ada_komplain" && s.complaint_reason && <div className="mt-4 rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700"><span className="font-semibold">Alasan Komplain:</span> {s.complaint_reason}</div>}
            <div className="mt-14 grid grid-cols-2 gap-6 text-center text-sm">
              <div><p className="font-medium">Checker</p><div className="mt-10 border-t border-slate-500 pt-1">{s.checker_name || ""}</div></div>
              <div><p className="font-medium">PIC Picking</p><div className="mt-10 border-t border-slate-500 pt-1">{s.picking_pic || ""}</div></div>
            </div>
          </div>
        </div>
      </div>
    </DialogContent>
  </Dialog>;
}
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Printer, Search, Package, Wand2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import BarcodeLabel from "@/components/shipping/BarcodeLabel";
import { formatDateId, generateShipmentBarcodes } from "@/components/shipping/shipmentBarcodeUtils";
import { statusMeta } from "@/components/shipping/shippingUtils";

export default function ShipmentBarcodeTab() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const { data: shipments = [], isLoading } = useQuery({
    queryKey: ["shipments-barcodes"],
    queryFn: () => base44.entities.Shipment.list("-created_date", 100),
  });

  const missingCount = shipments.filter((s) => !s.do_barcode).length;

  const generateMissing = async () => {
    setBusy(true); setMsg(null);
    try {
      const noBarcode = shipments.filter((s) => !s.do_barcode);
      if (!noBarcode.length) { setMsg({ type: "info", text: "Semua pengiriman sudah punya barcode." }); return; }
      const updates = noBarcode.map((s) => {
        const gen = generateShipmentBarcodes(s);
        return { id: s.id, do_barcode: gen.do_barcode, do_items: gen.do_items };
      });
      await base44.entities.Shipment.bulkUpdate(updates);
      qc.invalidateQueries({ queryKey: ["shipments-barcodes"] });
      setMsg({ type: "success", text: `${updates.length} barcode pengiriman berhasil di-generate.` });
    } catch (e) { setMsg({ type: "error", text: e.message }); }
    finally { setBusy(false); }
  };

  const q = search.trim().toLowerCase();
  const filtered = shipments.filter((s) => !q ||
    (s.outlet_name || "").toLowerCase().includes(q) ||
    (s.do_number || "").toLowerCase().includes(q) ||
    (s.do_barcode || "").toLowerCase().includes(q)
  );

  const printShipment = (shipment) => {
    const items = shipment.do_items || [];
    const labels = [
      `<div class="label do-label">
        <div class="lbl-type">DELIVERY ORDER</div>
        <div class="lbl-name">${(shipment.outlet_name || "").replace(/</g, "&lt;")}</div>
        <div class="lbl-do">DO: ${(shipment.do_number || "").replace(/</g, "&lt;")}</div>
        <div class="lbl-date">Tgl Kedatangan: ${formatDateId(shipment.delivery_date)}</div>
        <svg class="lbl-barcode" id="bc-do"></svg>
        <div class="lbl-code">${(shipment.do_barcode || "").replace(/</g, "&lt;")}</div>
      </div>`,
      ...items.map((it, i) => `
        <div class="label">
          <div class="lbl-name">${(it.name || "").replace(/</g, "&lt;")}</div>
          <div class="lbl-do">DO: ${(shipment.do_number || "").replace(/</g, "&lt;")}</div>
          <div class="lbl-date">Tgl Kedatangan: ${formatDateId(shipment.delivery_date)}</div>
          <svg class="lbl-barcode" id="bc-${i}"></svg>
          <div class="lbl-code">${(it.barcode || "").replace(/</g, "&lt;")}</div>
          <div class="lbl-qty">${it.quantity || 0} ${it.unit || ""}${it.koli ? " · " + it.koli : ""}</div>
        </div>`).join(""),
    ].join("");

    const win = window.open("", "_blank", "width=800,height=600");
    win.document.write(`<!DOCTYPE html><html><head><title>Barcode Pengiriman - ${shipment.do_number || shipment.outlet_name}</title>
      <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
      <style>
        @page { margin: 5mm; }
        body { font-family: Arial, sans-serif; margin: 0; padding: 10px; }
        .labels { display: flex; flex-wrap: wrap; gap: 6px; }
        .label { width: 200px; border: 1px dashed #ccc; padding: 8px; text-align: center; page-break-inside: avoid; }
        .do-label { border: 2px solid #4f46e5; background: #f5f3ff; }
        .lbl-type { font-size: 10px; font-weight: bold; color: #4f46e5; text-transform: uppercase; }
        .lbl-name { font-size: 11px; font-weight: bold; min-height: 28px; }
        .lbl-do { font-size: 10px; color: #666; }
        .lbl-date { font-size: 10px; color: #4f46e5; font-weight: bold; }
        .lbl-code { font-size: 9px; color: #666; margin-top: 2px; word-break: break-all; }
        .lbl-qty { font-size: 10px; color: #333; margin-top: 2px; }
        .lbl-barcode { width: 100%; height: 50px; }
      </style></head><body>
      <div class="labels">${labels}</div>
      <script>
        window.onload = function() {
          try { JsBarcode(document.getElementById("bc-do"), "${(shipment.do_barcode || "").replace(/"/g, "")}", {format:"CODE128",width:1.5,height:50,displayValue:false,margin:2}); } catch(e){}
          ${items.map((it, i) => `try { JsBarcode(document.getElementById("bc-${i}"), "${(it.barcode || "").replace(/"/g, "")}", {format:"CODE128",width:1.5,height:50,displayValue:false,margin:2}); } catch(e){}`).join("\n")}
          setTimeout(function(){ window.print(); }, 500);
        };
      </script>
      </body></html>`);
    win.document.close();
  };

  return (
    <div>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari outlet, nomor DO, atau barcode..." className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-indigo-500" />
        </div>
        {missingCount > 0 && (
          <Button onClick={generateMissing} disabled={busy} variant="outline" className="gap-1.5 shrink-0">
            <Wand2 className="h-4 w-4" />{busy ? "Memproses..." : `Generate ${missingCount} Barcode`}
          </Button>
        )}
      </div>
      {msg && (
        <div className={`mb-4 rounded-xl p-3 text-sm ${msg.type === "success" ? "bg-emerald-50 text-emerald-700" : msg.type === "error" ? "bg-rose-50 text-rose-700" : "bg-slate-50 text-slate-700"}`}>
          {msg.text}
        </div>
      )}
      {isLoading ? <div className="flex justify-center py-16"><div className="h-7 w-7 animate-spin rounded-full border-4 border-indigo-100 border-t-indigo-600" /></div> :
        filtered.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center text-sm text-slate-500">Belum ada pengiriman.</div> :
        <div className="space-y-3">
          {filtered.map((s) => {
            const meta = statusMeta[s.status] || {};
            const items = s.do_items || [];
            return (
              <div key={s.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-800">{s.outlet_name || "(tanpa outlet)"}</p>
                    <p className="text-xs text-slate-500">{s.do_number || "Tanpa DO"} · {formatDateId(s.delivery_date)}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${meta.className || "bg-slate-100 text-slate-600 border-slate-200"}`}>{meta.label || s.status}</span>
                    <Button onClick={() => printShipment(s)} variant="outline" size="sm" className="gap-1.5"><Printer className="h-3.5 w-3.5" />Cetak</Button>
                  </div>
                </div>
                <div className="mt-3 rounded-xl border border-indigo-100 bg-indigo-50/40 p-3">
                  <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-indigo-600">Barcode DO</p>
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-slate-600">{s.do_barcode || "Belum ada barcode"}</p>
                      <p className="text-[11px] text-slate-400">Scan untuk verifikasi DO · Tgl kedatangan: {formatDateId(s.delivery_date)}</p>
                    </div>
                    <div className="shrink-0 rounded-lg bg-white py-1 px-2"><BarcodeLabel value={s.do_barcode} height={36} fontSize={9} displayValue={false} /></div>
                  </div>
                </div>
                {items.length > 0 && (
                  <div className="mt-2 space-y-1.5">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Barcode per Barang ({items.length})</p>
                    {items.map((it, i) => (
                      <div key={i} className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium text-slate-700">{it.name || "(tanpa nama)"}</p>
                          <p className="text-[11px] text-slate-400">{it.quantity || 0} {it.unit || ""}{it.koli ? " · " + it.koli : ""} · {it.barcode || "-"}</p>
                        </div>
                        <div className="shrink-0"><BarcodeLabel value={it.barcode} height={28} fontSize={8} displayValue={false} /></div>
                      </div>
                    ))}
                  </div>
                )}
                {items.length === 0 && (
                  <div className="mt-2 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-400">
                    <Package className="h-3.5 w-3.5" /> Belum ada item pada DO ini.
                  </div>
                )}
              </div>
            );
          })}
        </div>
      }
    </div>
  );
}
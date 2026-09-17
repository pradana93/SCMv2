import { useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { generateKoliBarcode } from "@/components/shipping/shipmentBarcodeUtils";
import { ArrowLeft, Package, MapPin, Boxes, Barcode } from "lucide-react";
import BarcodeLabel from "@/components/shipping/BarcodeLabel";

const esc = (v) => String(v == null ? "" : v);

export default function KoliDetail() {
  const { suffix, koliNo } = useParams();
  const navigate = useNavigate();

  const { data: shipments = [], isLoading } = useQuery({
    queryKey: ["shipments", "koliLookup"],
    queryFn: () => base44.entities.Shipment.list("-created_date", 500),
  });

  const shipment = useMemo(() => {
    if (!suffix) return null;
    const suf = String(suffix).toUpperCase();
    return shipments.find((s) => String(s.id || "").replace(/[^a-f0-9]/gi, "").slice(-12).toUpperCase() === suf) || null;
  }, [shipments, suffix]);

  const koliData = useMemo(() => {
    if (!shipment) return null;
    const sheets = Array.isArray(shipment.packing_list_data) ? shipment.packing_list_data : [];
    const rows = [];
    sheets.forEach((sh) => {
      (sh.items || []).forEach((it) => {
        if (String(it.no_koli || "") === String(koliNo || "")) rows.push({ ...it, _sheet: sh });
      });
    });
    if (!rows.length) return null;
    const totalKoli = new Set();
    sheets.forEach((sh) => (sh.items || []).forEach((it) => totalKoli.add(String(it.no_koli || ""))));
    const totalQty = rows.reduce((s, r) => s + Number(r.qty || 0), 0);
    const sh = rows[0]._sheet || {};
    return {
      rows,
      outletName: sh.ship_to || shipment.outlet_name || "-",
      warehouse: shipment.warehouse || "-",
      totalKoliCount: totalKoli.size,
      totalQty,
      doNumber: shipment.do_number || "",
      deliveryDate: shipment.delivery_date || "",
      barcode: generateKoliBarcode(shipment, koliNo),
    };
  }, [shipment, koliNo]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-100 border-t-indigo-600" />
      </div>
    );
  }

  if (!shipment || !koliData) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50 p-6 text-center">
        <Package className="h-12 w-12 text-slate-300" />
        <p className="text-sm font-semibold text-slate-600">Data koli tidak ditemukan</p>
        <p className="text-xs text-slate-400">Barcode: K{suffix}-{koliNo}</p>
        <button onClick={() => navigate(-1)} className="mt-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">Kembali</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-10">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <button onClick={() => navigate(-1)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-slate-800">Detail Stiker Koli</p>
            <p className="truncate text-xs text-slate-400">DO: {koliData.doNumber || "-"} · {koliData.deliveryDate || "-"}</p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 pt-4">
        {/* Sticker card (mirrors the printed label) */}
        <div className="overflow-hidden rounded-2xl border-2 border-slate-800 bg-white shadow-sm">
          <div className="border-b-2 border-slate-800 px-4 py-3 text-center">
            <p className="text-base font-bold text-slate-800">To: {koliData.outletName}</p>
          </div>
          <div className="border-b border-slate-300 px-4 py-2 text-center">
            <p className="text-sm font-bold text-slate-700">No. Koli: {koliNo} / {koliData.totalKoliCount}</p>
          </div>

          <div className="flex">
            {/* Items */}
            <div className="flex-1 border-r border-slate-300">
              <div className="px-4 pt-2 pb-1 text-sm font-bold text-slate-800">ITEMS :</div>
              <div className="border-t border-slate-300">
                {koliData.rows.map((r, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-2 last:border-b-0">
                    <span className="text-sm text-slate-700">{esc(r.description || "-")} {esc(r.qty ?? "")} {esc(r.item_unit || "")}</span>
                    <span className="h-4 w-4 shrink-0 rounded border border-slate-400" />
                  </div>
                ))}
              </div>
            </div>
            {/* Barcode */}
            <div className="flex w-40 flex-col items-center justify-center gap-2 p-3">
              <div className="flex w-full flex-col items-center gap-2 rounded-xl border border-slate-400 p-3">
                <BarcodeLabel value={koliData.barcode} height={48} fontSize={9} displayValue={false} />
                <span className="text-[10px] text-slate-500">{koliData.barcode}</span>
              </div>
            </div>
          </div>

          <div className="border-t-2 border-slate-800 px-4 py-2">
            <div className="flex justify-between py-0.5 text-sm">
              <span className="text-slate-600">Total Items:</span>
              <span className="font-bold text-slate-800">{koliData.totalQty}</span>
            </div>
            <div className="flex justify-between py-0.5 text-sm">
              <span className="text-slate-600">Delivered From :</span>
              <span className="font-bold text-slate-800">{koliData.warehouse}</span>
            </div>
          </div>
        </div>

        {/* Info summary */}
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-slate-400"><MapPin className="h-4 w-4" /><span className="text-xs font-semibold uppercase">Outlet</span></div>
            <p className="mt-1 text-sm font-bold text-slate-800">{koliData.outletName}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-slate-400"><Boxes className="h-4 w-4" /><span className="text-xs font-semibold uppercase">Total Koli</span></div>
            <p className="mt-1 text-sm font-bold text-slate-800">{koliNo} / {koliData.totalKoliCount}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-slate-400"><Barcode className="h-4 w-4" /><span className="text-xs font-semibold uppercase">Barcode Koli</span></div>
            <p className="mt-1 break-all text-xs font-bold text-slate-800">{koliData.barcode}</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Link to="/pengiriman" className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">Lihat Daftar Pengiriman</Link>
          <button onClick={() => navigate(-1)} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">Kembali</button>
        </div>
      </div>
    </div>
  );
}
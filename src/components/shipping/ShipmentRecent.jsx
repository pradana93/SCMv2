import { Truck } from "lucide-react";
import { formatTonnage, statusMeta } from "./shippingUtils";

export default function ShipmentRecent({ shipments, loading }) {
  if (loading) return <div className="flex justify-center py-12"><div className="h-7 w-7 animate-spin rounded-full border-4 border-indigo-100 border-t-indigo-600" /></div>;
  if (!shipments.length) return <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center"><Truck className="mx-auto mb-3 h-8 w-8 text-slate-300" /><p className="font-medium">Belum ada pengiriman</p></div>;
  return <div className="space-y-3">
    {shipments.map((item) => {
      const meta = statusMeta[item.status] || statusMeta.menunggu_antrian;
      return <div key={item.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="min-w-0">
          <p className="truncate font-semibold">{item.outlet_name}</p>
          <p className="mt-0.5 text-xs text-slate-500">{formatTonnage(item.tonnage)} · {item.fleet}</p>
        </div>
        <span className={`inline-flex shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${meta.className}`}>{meta.label}</span>
      </div>;
    })}
  </div>;
}
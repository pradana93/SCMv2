import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useOutletEtaMap } from "./etaUtils";
import { convertToBase } from "./unitConversion";

const norm = (s) => (s || "").trim().toLowerCase();
const normKey = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

// Auto-sync receipts from cross-warehouse shipments.
// When a shipment's outlet_name matches a master warehouse name, the destination
// is actually another warehouse — auto-create a PENDING CONFIRMATION receipt so
// the receiving warehouse can confirm before it enters the main arrival plan list.
export function useAutoSyncReceipts() {
  const qc = useQueryClient();
  const etaMap = useOutletEtaMap();
  const runningRef = useRef(false);
  const { data: shipments = [] } = useQuery({ queryKey: ["shipments", "receipt-sync"], queryFn: () => base44.entities.Shipment.list("-delivery_date", 500) });
  const { data: warehouses = [] } = useQuery({ queryKey: ["warehouses"], queryFn: () => base44.entities.Warehouse.list() });
  const { data: stockItems = [] } = useQuery({ queryKey: ["stockItems"], queryFn: () => base44.entities.StockItem.list() });
  const { data: existingReceipts = [] } = useQuery({ queryKey: ["receipts"], queryFn: () => base44.entities.Receipt.list("-arrival_date", 500) });

  useEffect(() => {
    if (runningRef.current) return;
    if (!shipments.length || !warehouses.length) return;

    const warehouseKeys = new Set(warehouses.map((w) => normKey(w.name)));
    // Track all receipts already linked to a shipment (any status)
    const syncedIds = new Set(existingReceipts.map((r) => r.source_shipment_id).filter(Boolean));

    const toCreate = [];
    for (const s of shipments) {
      if (!s.outlet_name) continue;
      if (!warehouseKeys.has(normKey(s.outlet_name))) continue;
      if (normKey(s.outlet_name) === normKey(s.warehouse)) continue; // same warehouse, skip
      if (syncedIds.has(s.id)) continue;

      // Compute ETA-based arrival date
      let arrivalDate = s.delivery_date;
      const etaDays = etaMap?.get(s.outlet_name) ?? 0;
      if (etaDays > 0 && s.delivery_date) {
        const d = new Date(`${s.delivery_date}T00:00:00`);
        d.setDate(d.getDate() + etaDays);
        arrivalDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      }

      // Map DO items to receipt items with tonnage
      const doItems = Array.isArray(s.do_items) ? s.do_items : [];
      const items = doItems
        .filter((it) => it.name && Number(it.quantity) > 0)
        .map((it) => {
          const item = stockItems.find((si) => norm(si.name) === norm(it.name));
          const gramasi = Number(item?.gramasi) || 0;
          const baseQty = convertToBase(item, Number(it.quantity), it.unit);
          return {
            item_name: it.name,
            quantity: Number(it.quantity),
            unit: it.unit || "",
            tonnage: gramasi > 0 ? Math.round(baseQty * gramasi * 100) / 100 : 0,
            note: "",
          };
        });

      if (!items.length) continue;

      toCreate.push({
        arrival_date: arrivalDate || new Date().toISOString().slice(0, 10),
        warehouse: s.outlet_name,
        sender_name: s.warehouse || "Gudang Asal",
        status: "pending_confirmation",
        note: `Menunggu konfirmasi dari pengiriman DO: ${s.do_number || s.id}`,
        source_shipment_id: s.id,
        items,
        status_history: [{ status: "pending_confirmation", timestamp: new Date().toISOString(), note: `Auto-created dari pengiriman ke ${s.outlet_name}`, by: "System" }],
      });
    }

    if (!toCreate.length) return;
    runningRef.current = true;
    base44.entities.Receipt.bulkCreate(toCreate)
      .then(() => {
        qc.invalidateQueries({ queryKey: ["receipts"] });
      })
      .catch(() => {})
      .finally(() => { runningRef.current = false; });
  }, [shipments, warehouses, stockItems, existingReceipts, etaMap, qc]);

  return { syncedCount: existingReceipts.filter((r) => r.source_shipment_id).length };
}
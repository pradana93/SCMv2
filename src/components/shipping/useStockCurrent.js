import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { ALL_WAREHOUSES } from "./shippingUtils";
import { convertToBase } from "./unitConversion";

const norm = (s) => (s || "").trim().toLowerCase();

// Hook untuk menghitung sisa stok terkini per barang per gudang.
// Mengikuti logika yang sama dengan halaman Stock Control.
export function useStockCurrent() {
  const { data: items = [] } = useQuery({ queryKey: ["stockItems"], queryFn: () => base44.entities.StockItem.list() });
  const { data: movements = [] } = useQuery({ queryKey: ["stockMovements"], queryFn: () => base44.entities.StockMovement.list("-created_date", 500) });
  const { data: shipments = [] } = useQuery({ queryKey: ["shipments", "stock"], queryFn: () => base44.entities.Shipment.list("-delivery_date", 500) });

  const currentFor = (name, warehouse = ALL_WAREHOUSES, asOfDate = null) => {
    const k = norm(name);
    if (!k) return 0;
    const item = items.find((i) => norm(i.name) === k);
    const whArr = Array.isArray(warehouse) ? warehouse : null;
    const isAll = whArr ? whArr.length === 0 : warehouse === ALL_WAREHOUSES;
    const matchWh = (w) => isAll || !w || (whArr ? whArr.includes(w) : w === warehouse);
    let masuk = 0;
    let keluar = 0;
    for (const m of movements) {
      if (m.type !== "masuk") continue;
      if (asOfDate && m.date && m.date > asOfDate) continue;
      if (!matchWh(m.warehouse)) continue;
      if (norm(m.item_name) === k) masuk += convertToBase(item, m.quantity, m.unit);
    }
    for (const s of shipments) {
      if (s.status !== "sudah_dikirim") continue;
      if (asOfDate && s.delivery_date && s.delivery_date > asOfDate) continue;
      if (!matchWh(s.warehouse)) continue;
      for (const it of (Array.isArray(s.do_items) ? s.do_items : [])) {
        if (norm(it.name) === k) keluar += convertToBase(item, it.quantity, it.unit);
      }
    }
    for (const m of movements) {
      if (m.type !== "keluar") continue;
      if (asOfDate && m.date && m.date > asOfDate) continue;
      if (!matchWh(m.warehouse)) continue;
      if (norm(m.item_name) === k) keluar += convertToBase(item, m.quantity, m.unit);
    }
    return masuk - keluar;
  };

  const unitFor = (name) => {
    const it = items.find((i) => norm(i.name) === norm(name));
    return it?.unit || "";
  };

  const unitsFor = (name) => {
    const it = items.find((i) => norm(i.name) === norm(name));
    if (!it) return [];
    if (Array.isArray(it.units) && it.units.length > 0) return it.units;
    return it.unit ? [{ name: it.unit, conversion: 1, is_base: true }] : [];
  };

  const gramasiFor = (name) => {
    const it = items.find((i) => norm(i.name) === norm(name));
    return Number(it?.gramasi) || 0;
  };

  // Calculate total tonnage from a list of items using gramasi (kg per base unit).
  // Items may use `name` (shipment do_items) or `item_name` (receipt items).
  const calcTonnage = (itemList) => {
    if (!Array.isArray(itemList)) return 0;
    return itemList.reduce((sum, it) => {
      const name = it.name || it.item_name || "";
      const item = items.find((i) => norm(i.name) === norm(name));
      const qtyBase = convertToBase(item, it.quantity, it.unit);
      return sum + (qtyBase * gramasiFor(name));
    }, 0);
  };

  const calcItemTonnage = (it) => {
    if (!it) return 0;
    const name = it.name || it.item_name || "";
    const item = items.find((i) => norm(i.name) === norm(name));
    const g = gramasiFor(name);
    if (g > 0) {
      const qtyBase = convertToBase(item, it.quantity, it.unit);
      return Math.round(qtyBase * g * 100) / 100;
    }
    return Number(it.tonnage) || 0;
  };

  return { currentFor, unitFor, unitsFor, gramasiFor, calcTonnage, calcItemTonnage, items };
}
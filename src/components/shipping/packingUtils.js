const norm = (v) => String(v ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

const MONTHS_ID = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

export function formatDeliveryDateLong(iso) {
  if (!iso) return "-";
  const s = String(iso);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return s;
  return `${Number(m[3])} ${MONTHS_ID[Number(m[2]) - 1]} ${m[1]}`;
}

/**
 * Convert DO items into packing-list rows using the master packing data.
 * Conversion guide (from Master Data Packing List):
 *  - Each master item has `satuan` (base unit, e.g. Pack/Bks) and `qty_max`
 *    (how many base units fit in one Dus / box).
 *  - When a DO item is expressed in "Dus" and the master base unit is NOT "Dus",
 *    multiply the quantity by qty_max and switch the unit to the master satuan.
 *  - Otherwise keep the DO quantity in the master base unit.
 */
export function buildMasterMap(masterItems) {
  const map = new Map();
  for (const mi of masterItems || []) {
    if (mi && mi.name) map.set(norm(mi.name), mi);
  }
  return map;
}

export function convertItem(it, masterMap) {
  const mi = masterMap.get(norm(it.name));
  let qty = it.quantity;
  let unit = it.unit || "";
  if (mi) {
    const qtyMax = Number(mi.qty_max);
    const isDus = norm(it.unit) === "dus";
    const masterIsDus = norm(mi.satuan) === "dus";
    if (isDus && !masterIsDus && Number.isFinite(qtyMax) && qtyMax > 0) {
      qty = (Number(it.quantity) || 0) * qtyMax;
    }
    unit = mi.satuan || unit;
  }
  return { qty, unit: unit || "-" };
}
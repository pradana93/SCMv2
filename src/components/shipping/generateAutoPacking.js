// Auto-generate packing list from DO/IT items using MasterPackingItem database.
// Each DO item is matched by code (primary) or name (fallback) to get qty_max
// (Maksimal 1 Koli). Items are then split into koli groups, each holding at most
// qty_max units. The result matches the Shipment.packing_list_data structure so
// it can be saved directly and printed as per-koli labels.

const normKey = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Build a lookup map from MasterPackingItem records.
 * Returns { byCode: Map, byName: Map }
 */
export function buildPackingLookup(masterItems = []) {
  const byCode = new Map();
  const byName = new Map();
  for (const m of masterItems) {
    const code = String(m.code || "").trim();
    const name = String(m.name || "").trim();
    if (code) byCode.set(normKey(code), m);
    if (name) byName.set(normKey(name), m);
  }
  return { byCode, byName };
}

/**
 * Match a single DO item to a MasterPackingItem.
 * Priority: exact code → exact name → partial name contains.
 */
export function matchPackingItem(doItem, lookup) {
  const code = String(doItem.code || "").trim();
  const name = String(doItem.name || "").trim();
  if (code) {
    const m = lookup.byCode.get(normKey(code));
    if (m) return m;
  }
  if (name) {
    const nk = normKey(name);
    const exact = lookup.byName.get(nk);
    if (exact) return exact;
    // Partial fallback: name contains or is contained
    for (const [key, m] of lookup.byName) {
      if (key.includes(nk) || nk.includes(key)) return m;
    }
  }
  return null;
}

/**
 * Split a DO item into koli-sized chunks.
 * Each koli holds at most qtyMax units. Returns an array of { qty, koliIndex }.
 */
export function splitIntoKoli(quantity, qtyMax) {
  const qty = Math.max(0, Number(quantity) || 0);
  const max = Math.max(1, Number(qtyMax) || 1);
  if (qty <= 0) return [];
  const chunks = [];
  let remaining = qty;
  while (remaining > 0) {
    const chunk = Math.min(remaining, max);
    chunks.push(chunk);
    remaining -= chunk;
  }
  return chunks;
}

/**
 * Generate packing_list_data from a single DO's items.
 * Returns an array with one sheet object (ready for Shipment.packing_list_data).
 */
export function generateAutoPackingList(doItem, masterItems = [], options = {}) {
  const lookup = masterItems.__lookup || buildPackingLookup(masterItems);
  const items = Array.isArray(doItem?.do_items) ? doItem.do_items : [];
  const outlet = doItem?.outlet_name || "";
  const doNumber = doItem?.do_number || "";
  const deliveryDate = doItem?.delivery_date || "";
  const warehouse = doItem?.warehouse || "";

  // Build koli groups: each group is an array of { description, qty, item_unit, no_koli }
  const koliGroups = [];
  let unmatched = [];

  for (const it of items) {
    const name = String(it.name || "").trim();
    if (!name) continue;
    const qty = Number(it.quantity) || 0;
    if (qty <= 0) continue;

    const master = matchPackingItem(it, lookup);
    const qtyMax = master ? (Number(master.qty_max) || 1) : 1;
    const unit = String(it.unit || (master?.satuan) || "").trim();
    const kategori = master ? (master.kategori || "") : "";

    const chunks = splitIntoKoli(qty, qtyMax);
    if (chunks.length === 0) continue;

    if (!master) unmatched.push(name);

    for (let i = 0; i < chunks.length; i++) {
      // Reuse existing koli group if it has room and same item type
      // Strategy: each chunk is a new koli (simple, predictable for packing)
      const koliNum = String(koliGroups.length + 1);
      koliGroups.push({
        no_koli: koliNum,
        description: name,
        qty: chunks[i],
        satuan_gramasi: kategori,
        total_gramasi: 0,
        item_unit: unit,
        notes: chunks.length > 1 ? `Koli ${i + 1}/${chunks.length}` : "",
      });
    }
  }

  // Merge koli groups: combine items into the same koli number if total items
  // per koli is within limits. For simplicity, each chunk = 1 koli (one item type per koli).
  // But we can merge small items: if multiple items fit in one koli, group them.
  // Strategy: greedy merge — try to fit multiple items into one koli if each is within qtyMax.
  const mergedKoli = mergeKoliGroups(koliGroups, items, lookup);

  const sheet = {
    sheet_name: doNumber || outlet || "Auto Packing",
    ship_to: outlet,
    delivery_no: doNumber,
    ship_via: "",
    delivery_date: deliveryDate,
    columns: ["no_koli", "description", "qty", "satuan_gramasi", "total_gramasi", "item_unit", "notes"],
    items: mergedKoli,
  };

  return { sheet, unmatched, totalKoli: mergedKoli.reduce((acc, r) => Math.max(acc, Number(r.no_koli) || 0), 0) };
}

/**
 * Merge koli groups: try to combine different item types into the same koli
 * when they are small. Each koli can hold multiple item types as long as
 * each item type's quantity does not exceed its own qtyMax.
 * Simple approach: group by koli number sequentially — each item chunk gets
 * its own koli unless we want to merge. For now, keep one item per koli for clarity.
 * 
 * Actually, real packing lists often have multiple items per koli. We merge
 * items that are "small" (qty <= qtyMax and qtyMax is large enough) into shared koli.
 * 
 * Simplified: just assign sequential koli numbers, one per chunk.
 * This is the safest approach for auto-generation.
 */
function mergeKoliGroups(koliGroups, items, lookup) {
  // Keep simple: each chunk is its own koli with sequential numbering.
  // This ensures each koli label shows one item type with clear qty.
  return koliGroups.map((g, i) => ({ ...g, no_koli: String(i + 1) }));
}

/**
 * Batch generate packing lists for multiple DOs.
 * @param {Array} dos - Array of DO objects with do_items
 * @param {Array} masterItems - MasterPackingItem records
 * @returns {Map} doNumber → { sheet, unmatched, totalKoli }
 */
export function generateAutoPackingBatch(dos = [], masterItems = []) {
  const lookup = buildPackingLookup(masterItems);
  const result = new Map();
  for (const d of dos) {
    const key = d.do_number || d.outlet_name || "";
    const r = generateAutoPackingList(d, masterItems, {});
    // Attach lookup so we don't rebuild it each time
    result.set(key, { ...r, doNumber: key });
  }
  return result;
}
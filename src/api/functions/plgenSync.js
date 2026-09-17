// PLGen → SCM bridge (read-only on the PLGen side).
//
// When PLGen users export a packing list, PLGen persists it to its own
// Supabase project (packing_status + item_usage rows keyed by delivery_no).
// This service reads those rows via PLGen's anon key and creates the
// matching Shipment (Pengiriman) rows in the SCM project — no change to
// PLGen code, repo, or database is required.
//
// Mapping (verified against live PLGen data + SCM ReportMasterData export):
//   outlet_name   = PLGen outlet (e.g. "BBT - CIAWI"; auto-created in Outlet master)
//   do_number     = PLGen delivery_no (e.g. "DO/BBT/17092026/002") — also the dedup key
//   tonnage       = total_weight_kg
//   status        = "menunggu_antrian"
//   checker_name  = PLGen checker ("Aji"; "Fadly | Cluster: TRAGA 62" → "Fadly")
//   fleet         = best-effort match of the "Cluster: X" hint against Fleet master
//   delivery_date = export date (WIB) + 1 working day, skipping Sundays
//                   (replicates PLGen getDeliveryDateWIB(1); PLGen holidays unknown here)
//   warehouse     = by company code in delivery_no (WAREHOUSE_BY_COMPANY below)
//   do_items      = item_usage SKU totals, unit/code resolved from SCM masters
//   barcodes      = generated with the same helper as manual shipments

import { createClient } from '@supabase/supabase-js';
import { entityApi } from '../db';
import { generateShipmentBarcodes } from '@/components/shipping/shipmentBarcodeUtils';
import { ensureOutlet } from '@/components/shipping/ensureOutlet';

const PLGEN_URL = import.meta.env.VITE_PLGEN_SUPABASE_URL;
const PLGEN_ANON_KEY = import.meta.env.VITE_PLGEN_SUPABASE_ANON_KEY;

export const isPlgenSyncConfigured = !!(PLGEN_URL && PLGEN_ANON_KEY);

// Origin warehouse follows the outlet name: contains "BBT" → Gudang Vittoria,
// otherwise Vittoria. Adjust to taste.
export const BBT_WAREHOUSE = 'Gudang Vittoria';
export const DEFAULT_WAREHOUSE = 'Vittoria';

const SYNC_LIMIT = 200;

function plgenClient() {
  if (!isPlgenSyncConfigured) throw new Error('PLGen sync is not configured (VITE_PLGEN_SUPABASE_URL/KEY missing)');
  return createClient(PLGEN_URL, PLGEN_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const normKey = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

// WIB calendar date (YYYY-MM-DD) of an ISO timestamp + N working days, skipping Sundays.
function addWorkingDaysWib(isoTs, days) {
  const wib = new Date(new Date(isoTs).getTime() + 7 * 3600 * 1000);
  const d = new Date(Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth(), wib.getUTCDate()));
  let added = 0;
  while (added < days) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (d.getUTCDay() !== 0) added++;
  }
  return d.toISOString().slice(0, 10);
}

function splitChecker(checker) {
  const raw = String(checker || '').trim();
  const m = raw.split('|');
  let name = (m[0] || '').trim();
  let cluster = '';
  for (const part of m.slice(1)) {
    const cm = part.match(/cluster\s*:\s*(.+)/i);
    if (cm) cluster = cm[1].trim();
  }
  if (!name) name = raw;
  return { name, cluster };
}

function matchFleet(cluster, fleets) {
  if (!cluster) return '';
  const ck = normKey(cluster);
  if (!ck) return '';
  const hit =
    fleets.find((f) => normKey(f.name) === ck) ||
    fleets.find((f) => normKey(f.name).includes(ck)) ||
    fleets.find((f) => ck.includes(normKey(f.name)) && normKey(f.name).length >= 4);
  return hit ? hit.name : '';
}

function resolveWarehouse(outletName, warehouseNames) {
  const names = warehouseNames || [];
  const set = new Set(names);
  const preferred = /bbt/i.test(outletName || '') ? BBT_WAREHOUSE : DEFAULT_WAREHOUSE;
  if (set.has(preferred)) return preferred;
  if (set.has(BBT_WAREHOUSE)) return BBT_WAREHOUSE;
  if (set.has(DEFAULT_WAREHOUSE)) return DEFAULT_WAREHOUSE;
  return names[0] || '';
}

// Fetch recent PLGen exports with aggregated items. Oldest-first for creation.
export async function fetchPlgenExports(limit = SYNC_LIMIT) {
  const pg = plgenClient();
  const { data: statuses, error: e1 } = await pg
    .from('packing_status')
    .select('delivery_no,outlet,checker,status,total_weight_kg,created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (e1) throw new Error(e1.message || 'Gagal membaca packing_status PLGen');
  const rows = (statuses || []).filter((r) => r && r.delivery_no);
  if (!rows.length) return [];
  const nos = [...new Set(rows.map((r) => r.delivery_no))];
  const { data: usage, error: e2 } = await pg.from('item_usage').select('delivery_no,items').in('delivery_no', nos);
  if (e2) throw new Error(e2.message || 'Gagal membaca item_usage PLGen');
  const itemsByNo = {};
  for (const u of usage || []) {
    const no = u && u.delivery_no;
    if (!no) continue;
    if (!itemsByNo[no]) itemsByNo[no] = {};
    const items = (u && u.items) || {};
    for (const [sku, qty] of Object.entries(items)) {
      const q = Number(qty) || 0;
      if (!sku || q <= 0) continue;
      itemsByNo[no][sku] = (itemsByNo[no][sku] || 0) + q;
    }
  }
  return rows
    .slice()
    .reverse()
    .map((r) => ({ ...r, items: itemsByNo[r.delivery_no] || {} }));
}

function buildShipment(pl, masters) {
  const { stockByName, packingByName, fleetList, warehouseNames } = masters;
  const { name: checkerName, cluster } = splitChecker(pl.checker);
  const deliveryDate = addWorkingDaysWib(pl.created_at || new Date().toISOString(), 1);
  const doItems = Object.entries(pl.items || {}).map(([sku, qty]) => {
    const st = stockByName.get(sku);
    const mp = packingByName.get(sku);
    return {
      code: (st && st.code) || '',
      name: sku,
      quantity: Number(qty) || 0,
      unit: (st && st.unit) || (mp && mp.satuan) || 'Pack',
    };
  });
  const now = new Date().toISOString();
  const payload = {
    outlet_name: pl.outlet,
    tonnage: Number(pl.total_weight_kg) || 0,
    status: 'menunggu_antrian',
    fleet: matchFleet(cluster, fleetList),
    delivery_date: deliveryDate,
    warehouse: resolveWarehouse(pl.outlet, warehouseNames),
    checker_name: checkerName,
    crew_count: 0,
    document_type: 'delivery_order',
    do_number: pl.delivery_no,
    do_items: doItems,
    packing_list_data: [
      {
        sheet_name: 'Packing List',
        ship_to: pl.outlet,
        delivery_no: pl.delivery_no,
        delivery_date: deliveryDate,
        items: doItems.map((it) => ({ description: it.name, qty: it.quantity, item_unit: it.unit })),
      },
    ],
    status_history: [
      { status: 'menunggu_antrian', timestamp: now, note: `Dibuat otomatis dari PLGen ${pl.delivery_no}`, by: 'PLGen Sync' },
    ],
  };
  return generateShipmentBarcodes(payload);
}

// Create SCM shipments for PLGen exports that don't have one yet (matched by do_number).
export async function syncPlgenShipments() {
  if (!isPlgenSyncConfigured) return { configured: false, created: [], skipped: 0 };
  const plans = await fetchPlgenExports();
  if (!plans.length) return { configured: true, created: [], skipped: 0 };

  const Shipments = entityApi('Shipment');
  const [recent, stockItems, packingItems, fleets, warehouses] = await Promise.all([
    Shipments.list('-created_date', 2000),
    entityApi('StockItem').list(),
    entityApi('MasterPackingItem').list(),
    entityApi('Fleet').list(),
    entityApi('Warehouse').list(),
  ]);
  const existingDo = new Set((recent || []).map((s) => s && s.do_number).filter(Boolean));
  const stockByName = new Map((stockItems || []).map((s) => [s.name, s]));
  const packingByName = new Map((packingItems || []).map((m) => [m.name, m]));
  const masters = {
    stockByName,
    packingByName,
    fleetList: fleets || [],
    warehouseNames: (warehouses || []).map((w) => w.name).filter(Boolean),
  };

  const created = [];
  let skipped = 0;
  for (const pl of plans) {
    if (existingDo.has(pl.delivery_no)) {
      skipped++;
      continue;
    }
    const payload = buildShipment(pl, masters);
    const rec = await Shipments.create(payload);
    existingDo.add(pl.delivery_no);
    created.push(rec);
    try {
      await ensureOutlet(pl.outlet);
    } catch {
      // ignore outlet-master errors; shipment is already created
    }
  }
  return { configured: true, created, skipped };
}

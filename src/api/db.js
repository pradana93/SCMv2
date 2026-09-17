// Supabase-backed entity layer with a Base44-compatible API.
// Storage model: public.<table> rows are { id, created_date, updated_date, data }.
// This module maps them to flat objects { id, created_date, updated_date, ...data }
// so the existing UI logic keeps working unchanged.
//
// Filtering/sorting/limiting is applied client-side to guarantee identical
// behaviour to Base44 (operators $gte/$lte/$gt/$lt/$ne/$in/$nin included).

import { supabase } from './supabaseClient';

// Base44 entity name -> Supabase table name
export const ENTITY_TABLE = {
  AccurateSetting: 'accurate_settings',
  Announcement: 'announcements',
  AuditLog: 'audit_logs',
  BarcodeScan: 'barcode_scans',
  Category: 'categories',
  FeaturePermission: 'feature_permissions',
  Fleet: 'fleets',
  Item: 'items',
  MasterPackingItem: 'master_packing_items',
  Outlet: 'outlets',
  Production: 'productions',
  ProductionProcess: 'production_processes',
  ProductionRequest: 'production_requests',
  Receipt: 'receipts',
  ReceiptProcess: 'receipt_processes',
  ReceiptVerification: 'receipt_verifications',
  Shipment: 'shipments',
  StockItem: 'stock_items',
  StockMovement: 'stock_movements',
  User: 'profiles',
  UserRequest: 'user_requests',
  Vendor: 'vendors',
  Warehouse: 'warehouses',
};

const PAGE_SIZE = 1000;

function fromRow(row) {
  if (!row) return row;
  return { id: row.id, created_date: row.created_date, updated_date: row.updated_date, ...(row.data || {}) };
}

function toData(payload) {
  const data = { ...(payload || {}) };
  delete data.id;
  delete data.created_date;
  delete data.updated_date;
  return data;
}

function getField(obj, field) {
  if (obj == null) return undefined;
  if (field in obj) return obj[field];
  return undefined;
}

function matchCondition(value, cond) {
  if (cond != null && typeof cond === 'object' && !Array.isArray(cond)) {
    const keys = Object.keys(cond);
    const isOperator = keys.some((k) => k.startsWith('$'));
    if (isOperator) {
      for (const op of keys) {
        const expected = cond[op];
        switch (op) {
          case '$gte':
            if (!(value >= expected)) return false;
            break;
          case '$lte':
            if (!(value <= expected)) return false;
            break;
          case '$gt':
            if (!(value > expected)) return false;
            break;
          case '$lt':
            if (!(value < expected)) return false;
            break;
          case '$ne':
            if (value === expected) return false;
            break;
          case '$in':
            if (!Array.isArray(expected) || !expected.includes(value)) return false;
            break;
          case '$nin':
            if (Array.isArray(expected) && expected.includes(value)) return false;
            break;
          default:
            return false;
        }
      }
      return true;
    }
  }
  // Plain equality (Base44 semantics: undefined matches only undefined)
  return value === cond;
}

function matchWhere(obj, where) {
  if (!where || Object.keys(where).length === 0) return true;
  return Object.entries(where).every(([field, cond]) => matchCondition(getField(obj, field), cond));
}

function parseSort(sort) {
  if (!sort) return null;
  const desc = sort.startsWith('-');
  const field = desc ? sort.slice(1) : sort;
  return { field, desc };
}

function applySortLimit(rows, sort, limit) {
  let out = rows;
  const parsed = parseSort(sort);
  if (parsed) {
    const { field, desc } = parsed;
    out = [...out].sort((a, b) => {
      const av = getField(a, field);
      const bv = getField(b, field);
      if (av == null && bv == null) return 0;
      if (av == null) return desc ? 1 : -1;
      if (bv == null) return desc ? -1 : 1;
      if (typeof av === 'number' && typeof bv === 'number') return desc ? bv - av : av - bv;
      const as = String(av);
      const bs = String(bv);
      if (as < bs) return desc ? 1 : -1;
      if (as > bs) return desc ? -1 : 1;
      return 0;
    });
  }
  if (typeof limit === 'number') out = out.slice(0, limit);
  return out;
}

async function fetchAll(table) {
  const rows = [];
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from(table)
      .select('id,created_date,updated_date,data')
      .order('created_date', { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message || `Failed to fetch ${table}`);
    rows.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
    if (from > 10000) break; // safety cap, matches app-scale usage (limits <= 2000)
  }
  return rows.map(fromRow);
}

function makeEntity(entityName) {
  const table = ENTITY_TABLE[entityName];
  if (!table) throw new Error(`Unknown entity: ${entityName}`);

  return {
    async list(sort, limit) {
      // Base44 allows list("-field", 500) or list() or list("-field")
      if (typeof sort === 'number') {
        limit = sort;
        sort = undefined;
      }
      const rows = await fetchAll(table);
      return applySortLimit(rows, sort, limit);
    },

    async filter(where, sort, limit) {
      if (typeof sort === 'number') {
        limit = sort;
        sort = undefined;
      }
      const rows = await fetchAll(table);
      return applySortLimit(rows.filter((r) => matchWhere(r, where)), sort, limit);
    },

    async get(id) {
      const { data, error } = await supabase
        .from(table)
        .select('id,created_date,updated_date,data')
        .eq('id', id)
        .maybeSingle();
      if (error) throw new Error(error.message || `Failed to get ${entityName}`);
      if (!data) throw new Error(`${entityName} not found`);
      return fromRow(data);
    },

    async create(payload) {
      const { data, error } = await supabase
        .from(table)
        .insert({ data: toData(payload) })
        .select('id,created_date,updated_date,data')
        .single();
      if (error) throw new Error(error.message || `Failed to create ${entityName}`);
      return fromRow(data);
    },

    async update(id, patch) {
      const clean = toData(patch);
      // Merge with existing data so partial updates don't drop fields
      const { data: existing, error: readError } = await supabase
        .from(table)
        .select('id,data')
        .eq('id', id)
        .maybeSingle();
      if (readError) throw new Error(readError.message || `Failed to update ${entityName}`);
      if (!existing) throw new Error(`${entityName} not found`);
      const merged = { ...(existing.data || {}), ...clean };
      const { data, error } = await supabase
        .from(table)
        .update({ data: merged })
        .eq('id', id)
        .select('id,created_date,updated_date,data')
        .single();
      if (error) throw new Error(error.message || `Failed to update ${entityName}`);
      return fromRow(data);
    },

    async delete(id) {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw new Error(error.message || `Failed to delete ${entityName}`);
      return { ok: true };
    },

    async bulkCreate(items) {
      if (!items || items.length === 0) return [];
      const chunks = [];
      for (let i = 0; i < items.length; i += 200) chunks.push(items.slice(i, i + 200));
      const out = [];
      for (const chunk of chunks) {
        const { data, error } = await supabase
          .from(table)
          .insert(chunk.map((it) => ({ data: toData(it) })))
          .select('id,created_date,updated_date,data');
        if (error) throw new Error(error.message || `Failed to bulk create ${entityName}`);
        out.push(...(data || []).map(fromRow));
      }
      return out;
    },

    async bulkUpdate(items) {
      if (!items || items.length === 0) return [];
      const out = [];
      for (const item of items) {
        const { id, ...patch } = item;
        if (!id) continue;
        out.push(await this.update(id, patch));
      }
      return out;
    },

    async deleteMany(where) {
      const rows = await fetchAll(table);
      const matched = rows.filter((r) => matchWhere(r, where));
      for (let i = 0; i < matched.length; i += 200) {
        const chunk = matched.slice(i, i + 200);
        const { error } = await supabase.from(table).delete().in('id', chunk.map((r) => r.id));
        if (error) throw new Error(error.message || `Failed to deleteMany ${entityName}`);
      }
      return { deleted: matched.length };
    },

    subscribe(callback) {
      try {
        const channel = supabase
          .channel(`${table}-changes`)
          .on('postgres_changes', { event: '*', schema: 'public', table }, () => {
            try {
              callback();
            } catch {
              // ignore listener errors
            }
          })
          .subscribe();
        return () => {
          try {
            supabase.removeChannel(channel);
          } catch {
            // ignore
          }
        };
      } catch {
        return () => {};
      }
    },
  };
}

const entityCache = {};
export function entityApi(name) {
  if (!entityCache[name]) entityCache[name] = makeEntity(name);
  return entityCache[name];
}

// Eager proxy so `entities.Shipment.list()` etc. works like Base44
export const entities = new Proxy(
  {},
  {
    get(_target, prop) {
      if (typeof prop !== 'string') return undefined;
      if (!(prop in ENTITY_TABLE)) return undefined;
      return entityApi(prop);
    },
  }
);

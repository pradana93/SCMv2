// Accurate Online client (ported from base44/shared/accurateClient.ts).
// Runs in the browser against https://account.accurate.id.
// NOTE: direct browser calls can hit CORS limits on some Accurate endpoints.
// If that happens, deploy supabase/functions/accurate-proxy and set
// VITE_ACCURATE_PROXY_URL to it; this module will route through the proxy.

const OAUTH_BASE = 'https://account.accurate.id';
const AUTHORIZE_PATH = '/api/oauth/authorize';
const TOKEN_PATH = '/api/oauth/token';
const DB_LIST_PATH = '/api/db-list.do';
const OPEN_DB_PATH = '/api/open-db.do';

function proxyBase() {
  return (import.meta.env.VITE_ACCURATE_PROXY_URL || '').replace(/\/$/, '');
}

async function fetchJson(url, opts = {}) {
  const proxy = proxyBase();
  const target = proxy ? `${proxy}?url=${encodeURIComponent(url)}` : url;
  const res = await fetch(target, opts);
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export function getClientCredentials() {
  const clientId = import.meta.env.VITE_ACCURATE_CLIENT_ID || '';
  const clientSecret = import.meta.env.VITE_ACCURATE_CLIENT_SECRET || '';
  return { clientId, clientSecret, hasCredentials: !!(clientId && clientSecret) };
}

export function buildAuthUrl(clientId, redirectUri, scope = 'item_view item_save stock_in_save stock_out_save') {
  const params = new URLSearchParams({ response_type: 'code', client_id: clientId, redirect_uri: redirectUri, scope });
  return `${OAUTH_BASE}${AUTHORIZE_PATH}?${params.toString()}`;
}

export async function exchangeCode(code, redirectUri, clientId, clientSecret) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    client_secret: clientSecret,
  });
  const { res, data } = await fetchJson(`${OAUTH_BASE}${TOKEN_PATH}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) throw new Error(data?.error_description || data?.error || 'Gagal menukar kode otorisasi');
  return data;
}

export async function dbList(accessToken) {
  const { data } = await fetchJson(`${OAUTH_BASE}${DB_LIST_PATH}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!data.s) throw new Error('Gagal mengambil daftar database Accurate');
  return data.d || [];
}

export async function openDb(accessToken, dbId) {
  const { data } = await fetchJson(`${OAUTH_BASE}${OPEN_DB_PATH}?id=${dbId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!data.s) throw new Error('Gagal membuka database Accurate');
  return { session: data.session, host: data.host, accessibleUntil: data.accessibleUntil };
}

export async function apiCall(host, sessionId, accessToken, path, method = 'GET', body = null) {
  const url = `${host}/accurate/api/${path}`;
  const opts = {
    method,
    headers: { Authorization: `Bearer ${accessToken}`, 'X-Session-ID': sessionId },
  };
  if (body && method !== 'GET') {
    opts.headers['Content-Type'] = 'application/x-www-form-urlencoded';
    opts.body = new URLSearchParams(body).toString();
  } else if (body && method === 'GET') {
    const qs = new URLSearchParams(body).toString();
    const { data } = await fetchJson(`${url}?${qs}`, opts);
    return data;
  }
  const { data } = await fetchJson(url, opts);
  return data;
}

export async function syncMovement(host, sessionId, accessToken, movement, itemNoMap) {
  const itemNo = itemNoMap[movement.item_name];
  if (!itemNo)
    return { skipped: true, reason: `Barang "${movement.item_name}" belum tersinkron ke Accurate (no item tidak ditemukan)` };
  const endpoint = movement.type === 'masuk' ? 'stock-in/save.do' : 'stock-out/save.do';
  const body = {
    detailNo: [1],
    detailItemNo: [itemNo],
    detailQty: [Number(movement.quantity) || 0],
    detailWarehouseName: [movement.warehouse || ''],
    transDate: movement.date || new Date().toISOString().slice(0, 10),
    description: movement.note || `Sync dari SCM (${movement.reference || 'manual'})`,
  };
  const result = await apiCall(host, sessionId, accessToken, endpoint, 'POST', body);
  if (result.s === false) throw new Error(result.d || result.error || 'Gagal sinkron transaksi ke Accurate');
  return { synced: true, ref: result.d?.id || result.d?.no || '' };
}

export async function syncItem(host, sessionId, accessToken, item) {
  const body = {
    name: item.name,
    no: item.code || item.barcode || '',
    itemType: 'INVENTORY',
    unit: item.unit || 'PCS',
  };
  const result = await apiCall(host, sessionId, accessToken, 'item/save.do', 'POST', body);
  if (result.s === false) throw new Error(result.d || result.error || 'Gagal sinkron barang ke Accurate');
  return { synced: true, no: result.d?.no || item.code || '' };
}

export async function listItems(host, sessionId, accessToken) {
  const result = await apiCall(host, sessionId, accessToken, 'item/list.do', 'GET', {
    fields: 'id,name,no',
    'filter.itemType': 'INVENTORY',
  });
  if (result.s === false) throw new Error('Gagal mengambil daftar barang dari Accurate');
  return result.d || [];
}

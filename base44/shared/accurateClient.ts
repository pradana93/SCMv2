// Shared Accurate Online API client — used by the accurateApi backend function.
// Accurate Online API docs: https://accurate.id/api-integration/
//
// Flow: OAuth2 authorize -> exchange code for tokens -> db-list -> open-db (session+host) -> API calls with X-Session-ID.

const OAUTH_BASE = "https://account.accurate.id";
const AUTHORIZE_PATH = "/api/oauth/authorize";
const TOKEN_PATH = "/api/oauth/token";
const DB_LIST_PATH = "/api/db-list.do";
const OPEN_DB_PATH = "/api/open-db.do";

export function getSecrets(secrets) {
  const clientId = secrets.get("ACCURATE_CLIENT_ID");
  const clientSecret = secrets.get("ACCURATE_CLIENT_SECRET");
  return { clientId, clientSecret, hasCredentials: !!(clientId && clientSecret) };
}

export function buildAuthUrl(clientId, redirectUri, scope = "item_view item_save stock_in_save stock_out_save") {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope,
  });
  return `${OAUTH_BASE}${AUTHORIZE_PATH}?${params.toString()}`;
}

export async function exchangeCode(code, redirectUri, clientId, clientSecret) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    client_secret: clientSecret,
  });
  const res = await fetch(`${OAUTH_BASE}${TOKEN_PATH}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error_description || data?.error || "Gagal menukar kode otorisasi");
  return data; // { access_token, refresh_token, token_type, expires_in, scope }
}

export async function refreshToken(refreshTokenValue, clientId, clientSecret) {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshTokenValue,
    client_id: clientId,
    client_secret: clientSecret,
  });
  const res = await fetch(`${OAUTH_BASE}${TOKEN_PATH}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error_description || data?.error || "Gagal me-refresh token");
  return data;
}

export async function dbList(accessToken) {
  const res = await fetch(`${OAUTH_BASE}${DB_LIST_PATH}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  if (!data.s) throw new Error("Gagal mengambil daftar database Accurate");
  return data.d || [];
}

export async function openDb(accessToken, dbId) {
  const res = await fetch(`${OAUTH_BASE}${OPEN_DB_PATH}?id=${dbId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  if (!data.s) throw new Error("Gagal membuka database Accurate");
  return { session: data.session, host: data.host, accessibleUntil: data.accessibleUntil };
}

export async function apiCall(host, sessionId, accessToken, path, method = "GET", body = null) {
  const url = `${host}/accurate/api/${path}`;
  const opts = {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "X-Session-ID": sessionId,
    },
  };
  if (body && method !== "GET") {
    opts.headers["Content-Type"] = "application/x-www-form-urlencoded";
    opts.body = new URLSearchParams(body).toString();
  } else if (body && method === "GET") {
    const qs = new URLSearchParams(body).toString();
    return fetch(`${url}?${qs}`, opts).then((r) => r.json());
  }
  const res = await fetch(url, opts);
  const data = await res.json();
  return data;
}

// Sync a single StockMovement to Accurate as a stock-in or stock-out record.
export async function syncMovement(host, sessionId, accessToken, movement, itemNoMap) {
  const itemNo = itemNoMap[movement.item_name];
  if (!itemNo) return { skipped: true, reason: `Barang "${movement.item_name}" belum tersinkron ke Accurate (no item tidak ditemukan)` };
  const endpoint = movement.type === "masuk" ? "stock-in/save.do" : "stock-out/save.do";
  const body = {
    detailNo: [1],
    detailItemNo: [itemNo],
    detailQty: [Number(movement.quantity) || 0],
    detailWarehouseName: [movement.warehouse || ""],
    transDate: movement.date || new Date().toISOString().slice(0, 10),
    description: movement.note || `Sync dari Bangor WMS (${movement.reference || "manual"})`,
  };
  const result = await apiCall(host, sessionId, accessToken, endpoint, "POST", body);
  if (result.s === false) throw new Error(result.d || result.error || "Gagal sinkron transaksi ke Accurate");
  return { synced: true, ref: result.d?.id || result.d?.no || "" };
}

// Upsert an item master to Accurate (so stock-in/out can reference it).
export async function syncItem(host, sessionId, accessToken, item) {
  const body = {
    name: item.name,
    no: item.code || item.barcode || "",
    itemType: "INVENTORY",
    unit: item.unit || "PCS",
  };
  const result = await apiCall(host, sessionId, accessToken, "item/save.do", "POST", body);
  if (result.s === false) throw new Error(result.d || result.error || "Gagal sinkron barang ke Accurate");
  return { synced: true, no: result.d?.no || item.code || "" };
}

// List items from Accurate to build a name->no map.
export async function listItems(host, sessionId, accessToken) {
  const result = await apiCall(host, sessionId, accessToken, "item/list.do", "GET", {
    fields: "id,name,no",
    "filter.itemType": "INVENTORY",
  });
  if (result.s === false) throw new Error("Gagal mengambil daftar barang dari Accurate");
  return result.d || [];
}
// Independent replacement for the Base44 `accurateApi` backend function.
// Same action contract as base44/functions/accurateApi/entry.ts.
// AccurateSetting record lives in Supabase (label "default").

import { entityApi } from '../db';
import { authCompat } from '../authCompat';
import {
  getClientCredentials,
  buildAuthUrl,
  exchangeCode,
  dbList,
  openDb,
  syncMovement,
  syncItem,
  listItems,
} from './accurateClient';

function requireAdmin(user) {
  if (!user) {
    const err = new Error('Unauthorized');
    err.status = 401;
    throw err;
  }
  if (user.role !== 'admin' && user.role !== 'super_admin') {
    const err = new Error('Forbidden - hanya admin');
    err.status = 403;
    throw err;
  }
}

async function getSetting() {
  const list = await entityApi('AccurateSetting').filter({ label: 'default' });
  return list && list[0];
}

async function upsertSetting(patch) {
  const rec = await getSetting();
  if (rec) return entityApi('AccurateSetting').update(rec.id, patch);
  return entityApi('AccurateSetting').create({ label: 'default', ...patch });
}

export async function accurateApi(payload = {}) {
  const user = await authCompat.me();
  requireAdmin(user);

  const action = payload.action;
  const { clientId, clientSecret, hasCredentials } = getClientCredentials();
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const redirectUri = `${origin}/accurate`;

  if (action === 'status') {
    const rec = await getSetting();
    return {
      hasCredentials,
      connected: !!(rec && rec.access_token),
      dbOpened: !!(rec && rec.session_id && rec.host),
      setting: rec
        ? {
            status: rec.status,
            db_alias: rec.db_alias,
            db_id: rec.db_id,
            last_sync_at: rec.last_sync_at,
            last_error: rec.last_error,
            auto_sync: rec.auto_sync,
          }
        : null,
    };
  }

  if (action === 'getAuthUrl') {
    if (!hasCredentials) {
      const err = new Error(
        'VITE_ACCURATE_CLIENT_ID / VITE_ACCURATE_CLIENT_SECRET belum diset. Daftar di https://account.accurate.id/developer lalu set di .env.local.'
      );
      err.status = 400;
      throw err;
    }
    return { authUrl: buildAuthUrl(clientId, redirectUri) };
  }

  if (action === 'exchangeCode') {
    if (!hasCredentials) {
      const err = new Error('Kredensial Accurate belum diset');
      err.status = 400;
      throw err;
    }
    const code = payload.code;
    if (!code) {
      const err = new Error('Kode otorisasi tidak ditemukan');
      err.status = 400;
      throw err;
    }
    const tokens = await exchangeCode(code, redirectUri, clientId, clientSecret);
    await upsertSetting({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_type: tokens.token_type || 'bearer',
      expires_in: tokens.expires_in,
      token_acquired_at: new Date().toISOString(),
      status: 'authorized',
      last_error: '',
    });
    return { ok: true, message: 'Otorisasi berhasil. Pilih database untuk melanjutkan.' };
  }

  if (action === 'dbList') {
    const rec = await getSetting();
    if (!rec || !rec.access_token) {
      const err = new Error('Belum otorisasi');
      err.status = 400;
      throw err;
    }
    const dbs = await dbList(rec.access_token);
    return { dbs };
  }

  if (action === 'openDb') {
    const rec = await getSetting();
    if (!rec || !rec.access_token) {
      const err = new Error('Belum otorisasi');
      err.status = 400;
      throw err;
    }
    const dbId = Number(payload.db_id);
    if (!dbId) {
      const err = new Error('db_id diperlukan');
      err.status = 400;
      throw err;
    }
    const { session, host } = await openDb(rec.access_token, dbId);
    const db = (await dbList(rec.access_token)).find((d) => d.id === dbId);
    await upsertSetting({
      db_id: dbId,
      db_alias: db?.alias || '',
      session_id: session,
      host,
      session_opened_at: new Date().toISOString(),
      status: 'db_opened',
      last_error: '',
    });
    return { ok: true, session, host, alias: db?.alias || '' };
  }

  if (action === 'disconnect') {
    await upsertSetting({
      access_token: '',
      refresh_token: '',
      session_id: '',
      host: '',
      db_id: null,
      db_alias: '',
      status: 'disconnected',
      last_error: '',
    });
    return { ok: true };
  }

  if (action === 'setAutoSync') {
    await upsertSetting({ auto_sync: !!payload.auto_sync });
    return { ok: true };
  }

  const ensureSession = async () => {
    const rec = await getSetting();
    if (!rec || !rec.access_token) throw new Error('Belum otorisasi ke Accurate');
    if (!rec.session_id || !rec.host) throw new Error('Database Accurate belum dibuka');
    return rec;
  };

  if (action === 'syncItems') {
    const rec = await ensureSession();
    const items = await entityApi('StockItem').list();
    const results = [];
    for (const it of items) {
      try {
        const r = await syncItem(rec.host, rec.session_id, rec.access_token, it);
        if (r.synced && r.no) await entityApi('StockItem').update(it.id, { accurate_no: r.no });
        results.push({ name: it.name, ok: true });
      } catch (e) {
        results.push({ name: it.name, ok: false, error: e.message });
      }
    }
    return { results, total: items.length };
  }

  if (action === 'syncMovements') {
    const rec = await ensureSession();
    const accItems = await listItems(rec.host, rec.session_id, rec.access_token);
    const itemNoMap = {};
    for (const ai of accItems) itemNoMap[ai.name] = ai.no;
    const localItems = await entityApi('StockItem').list();
    for (const li of localItems) {
      if (li.accurate_no && !itemNoMap[li.name]) itemNoMap[li.name] = li.accurate_no;
    }
    const unsynced = await entityApi('StockMovement').filter({ accurate_synced: false });
    const results = [];
    let syncedCount = 0;
    for (const mv of unsynced) {
      try {
        const r = await syncMovement(rec.host, rec.session_id, rec.access_token, mv, itemNoMap);
        if (r.synced) {
          await entityApi('StockMovement').update(mv.id, {
            accurate_synced: true,
            accurate_sync_date: new Date().toISOString(),
            accurate_ref: r.ref || '',
          });
          syncedCount++;
        }
        results.push({ id: mv.id, item: mv.item_name, ok: r.synced || false, skipped: r.skipped, reason: r.reason });
      } catch (e) {
        results.push({ id: mv.id, item: mv.item_name, ok: false, error: e.message });
      }
    }
    await upsertSetting({ last_sync_at: new Date().toISOString() });
    return { results, synced: syncedCount, total: unsynced.length };
  }

  if (action === 'syncSingleMovement') {
    const rec = await ensureSession();
    const mvId = payload.movement_id;
    if (!mvId) {
      const err = new Error('movement_id diperlukan');
      err.status = 400;
      throw err;
    }
    const mv = await entityApi('StockMovement').get(mvId);
    if (!mv) {
      const err = new Error('Movement tidak ditemukan');
      err.status = 404;
      throw err;
    }
    const accItems = await listItems(rec.host, rec.session_id, rec.access_token);
    const itemNoMap = {};
    for (const ai of accItems) itemNoMap[ai.name] = ai.no;
    const localItems = await entityApi('StockItem').list();
    for (const li of localItems) {
      if (li.accurate_no && !itemNoMap[li.name]) itemNoMap[li.name] = li.accurate_no;
    }
    const r = await syncMovement(rec.host, rec.session_id, rec.access_token, mv, itemNoMap);
    if (r.synced) {
      await entityApi('StockMovement').update(mv.id, {
        accurate_synced: true,
        accurate_sync_date: new Date().toISOString(),
        accurate_ref: r.ref || '',
      });
    }
    return { ok: r.synced, skipped: r.skipped, reason: r.reason };
  }

  const err = new Error(`Unknown action: ${action}`);
  err.status = 400;
  throw err;
}

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from 'base44:runtime';
import {
  getSecrets, buildAuthUrl, exchangeCode, refreshToken,
  dbList, openDb, syncMovement, syncItem, listItems,
} from "../../shared/accurateClient.ts";

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin' && user.role !== 'super_admin') {
      return Response.json({ error: 'Forbidden - hanya admin' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action;
    const { clientId, clientSecret, hasCredentials } = getSecrets(secrets);

    // Redirect URI = origin of the app (frontend will handle callback)
    const origin = new URL(req.url).origin;
    const redirectUri = `${origin}/accurate`;

    // Get the active AccurateSetting record (single record, label "default")
    const getSetting = async () => {
      const list = await base44.asServiceRole.entities.AccurateSetting.filter({ label: "default" });
      return list && list[0];
    };
    const upsertSetting = async (patch) => {
      let rec = await getSetting();
      if (rec) {
        return base44.asServiceRole.entities.AccurateSetting.update(rec.id, patch);
      }
      return base44.asServiceRole.entities.AccurateSetting.create({ label: "default", ...patch });
    };

    if (action === 'status') {
      const rec = await getSetting();
      return Response.json({
        hasCredentials,
        connected: !!(rec && rec.access_token),
        dbOpened: !!(rec && rec.session_id && rec.host),
        setting: rec ? {
          status: rec.status, db_alias: rec.db_alias, db_id: rec.db_id,
          last_sync_at: rec.last_sync_at, last_error: rec.last_error, auto_sync: rec.auto_sync,
        } : null,
      });
    }

    if (action === 'getAuthUrl') {
      if (!hasCredentials) return Response.json({ error: 'ACCURATE_CLIENT_ID / ACCURATE_CLIENT_SECRET belum diset di secrets. Daftar di https://account.accurate.id/developer lalu set secret.' }, { status: 400 });
      return Response.json({ authUrl: buildAuthUrl(clientId, redirectUri) });
    }

    if (action === 'exchangeCode') {
      if (!hasCredentials) return Response.json({ error: 'Kredensial Accurate belum diset' }, { status: 400 });
      const code = body.code;
      if (!code) return Response.json({ error: 'Kode otorisasi tidak ditemukan' }, { status: 400 });
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
      return Response.json({ ok: true, message: 'Otorisasi berhasil. Pilih database untuk melanjutkan.' });
    }

    if (action === 'dbList') {
      const rec = await getSetting();
      if (!rec || !rec.access_token) return Response.json({ error: 'Belum otorisasi' }, { status: 400 });
      const dbs = await dbList(rec.access_token);
      return Response.json({ dbs });
    }

    if (action === 'openDb') {
      const rec = await getSetting();
      if (!rec || !rec.access_token) return Response.json({ error: 'Belum otorisasi' }, { status: 400 });
      const dbId = Number(body.db_id);
      if (!dbId) return Response.json({ error: 'db_id diperlukan' }, { status: 400 });
      const { session, host, accessibleUntil } = await openDb(rec.access_token, dbId);
      const db = (await dbList(rec.access_token)).find((d) => d.id === dbId);
      await upsertSetting({
        db_id: dbId, db_alias: db?.alias || '',
        session_id: session, host, session_opened_at: new Date().toISOString(),
        status: 'db_opened', last_error: '',
      });
      return Response.json({ ok: true, session, host, alias: db?.alias || '' });
    }

    if (action === 'disconnect') {
      await upsertSetting({
        access_token: '', refresh_token: '', session_id: '', host: '',
        db_id: null, db_alias: '', status: 'disconnected', last_error: '',
      });
      return Response.json({ ok: true });
    }

    if (action === 'setAutoSync') {
      await upsertSetting({ auto_sync: !!body.auto_sync });
      return Response.json({ ok: true });
    }

    // --- Sync actions (require open db) ---
    const ensureSession = async () => {
      const rec = await getSetting();
      if (!rec || !rec.access_token) throw new Error('Belum otorisasi ke Accurate');
      if (!rec.session_id || !rec.host) throw new Error('Database Accurate belum dibuka');
      return rec;
    };

    if (action === 'syncItems') {
      const rec = await ensureSession();
      const items = await base44.asServiceRole.entities.StockItem.list();
      const results = [];
      for (const it of items) {
        try {
          const r = await syncItem(rec.host, rec.session_id, rec.access_token, it);
          if (r.synced && r.no) await base44.asServiceRole.entities.StockItem.update(it.id, { accurate_no: r.no });
          results.push({ name: it.name, ok: true });
        } catch (e) {
          results.push({ name: it.name, ok: false, error: e.message });
        }
      }
      return Response.json({ results, total: items.length });
    }

    if (action === 'syncMovements') {
      const rec = await ensureSession();
      // Build item name -> Accurate no map
      const accItems = await listItems(rec.host, rec.session_id, rec.access_token);
      const itemNoMap = {};
      for (const ai of accItems) itemNoMap[ai.name] = ai.no;
      // Also use local accurate_no from StockItem as fallback
      const localItems = await base44.asServiceRole.entities.StockItem.list();
      for (const li of localItems) {
        if (li.accurate_no && !itemNoMap[li.name]) itemNoMap[li.name] = li.accurate_no;
      }
      const unsynced = await base44.asServiceRole.entities.StockMovement.filter({ accurate_synced: false });
      const results = [];
      let syncedCount = 0;
      for (const mv of unsynced) {
        try {
          const r = await syncMovement(rec.host, rec.session_id, rec.access_token, mv, itemNoMap);
          if (r.synced) {
            await base44.asServiceRole.entities.StockMovement.update(mv.id, {
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
      return Response.json({ results, synced: syncedCount, total: unsynced.length });
    }

    if (action === 'syncSingleMovement') {
      const rec = await ensureSession();
      const mvId = body.movement_id;
      if (!mvId) return Response.json({ error: 'movement_id diperlukan' }, { status: 400 });
      const mv = await base44.asServiceRole.entities.StockMovement.get(mvId);
      if (!mv) return Response.json({ error: 'Movement tidak ditemukan' }, { status: 404 });
      const accItems = await listItems(rec.host, rec.session_id, rec.access_token);
      const itemNoMap = {};
      for (const ai of accItems) itemNoMap[ai.name] = ai.no;
      const localItems = await base44.asServiceRole.entities.StockItem.list();
      for (const li of localItems) {
        if (li.accurate_no && !itemNoMap[li.name]) itemNoMap[li.name] = li.accurate_no;
      }
      const r = await syncMovement(rec.host, rec.session_id, rec.access_token, mv, itemNoMap);
      if (r.synced) {
        await base44.asServiceRole.entities.StockMovement.update(mv.id, {
          accurate_synced: true, accurate_sync_date: new Date().toISOString(), accurate_ref: r.ref || '',
        });
      }
      return Response.json({ ok: r.synced, skipped: r.skipped, reason: r.reason });
    }

    return Response.json({ error: 'Unknown action: ' + action }, { status: 400 });
  } catch (error) {
    // Persist error to setting if possible
    try {
      const base44 = createClientFromRequest(req);
      const list = await base44.asServiceRole.entities.AccurateSetting.filter({ label: "default" });
      if (list && list[0]) {
        await base44.asServiceRole.entities.AccurateSetting.update(list[0].id, { status: 'error', last_error: error.message });
      }
    } catch (_) {}
    return Response.json({ error: error.message }, { status: 500 });
  }
}
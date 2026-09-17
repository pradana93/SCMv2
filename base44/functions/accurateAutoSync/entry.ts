import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from 'base44:runtime';
import {
  getSecrets, syncMovement, listItems,
} from "../../shared/accurateClient.ts";

// Called by the "Accurate Auto Sync" workflow on every StockMovement create.
// Runs as service role (no user context). Silently skips when Accurate is
// not connected or auto_sync is off, so it never blocks transaction creation.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin' && user.role !== 'super_admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    const body = await req.json().catch(() => ({}));
    const movementId = body.movement_id;
    if (!movementId) return Response.json({ ok: false, reason: 'no movement_id' });

    const settings = await base44.asServiceRole.entities.AccurateSetting.filter({ label: "default" });
    const setting = settings && settings[0];
    if (!setting || !setting.access_token || !setting.session_id || !setting.host) {
      return Response.json({ ok: false, reason: 'accurate_not_connected' });
    }
    if (setting.auto_sync === false) {
      return Response.json({ ok: false, reason: 'auto_sync_disabled' });
    }

    const mv = await base44.asServiceRole.entities.StockMovement.get(movementId);
    if (!mv) return Response.json({ ok: false, reason: 'movement_not_found' });
    if (mv.accurate_synced) return Response.json({ ok: true, skipped: true, reason: 'already_synced' });

    const { clientId, clientSecret } = getSecrets(secrets);
    const accItems = await listItems(setting.host, setting.session_id, setting.access_token);
    const itemNoMap = {};
    for (const ai of accItems) itemNoMap[ai.name] = ai.no;
    const localItems = await base44.asServiceRole.entities.StockItem.list();
    for (const li of localItems) {
      if (li.accurate_no && !itemNoMap[li.name]) itemNoMap[li.name] = li.accurate_no;
    }

    const r = await syncMovement(setting.host, setting.session_id, setting.access_token, mv, itemNoMap);
    if (r.synced) {
      await base44.asServiceRole.entities.StockMovement.update(mv.id, {
        accurate_synced: true,
        accurate_sync_date: new Date().toISOString(),
        accurate_ref: r.ref || '',
      });
    }
    await base44.asServiceRole.entities.AccurateSetting.update(setting.id, { last_sync_at: new Date().toISOString() });
    return Response.json({ ok: r.synced || false, skipped: r.skipped, reason: r.reason });
  } catch (error) {
    try {
      const base44 = createClientFromRequest(req);
      const list = await base44.asServiceRole.entities.AccurateSetting.filter({ label: "default" });
      if (list && list[0]) {
        await base44.asServiceRole.entities.AccurateSetting.update(list[0].id, { status: 'error', last_error: error.message });
      }
    } catch (_) {}
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}
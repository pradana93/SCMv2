// Independent replacement for the Base44 `manageUsers` backend function.
// Same action contract, same role rules, backed by Supabase tables
// (profiles = User entity, user_requests = UserRequest entity).

import { entityApi } from '../db';
import { authCompat } from '../authCompat';

const SUPER_EMAILS = ['suhendra.a.d@gmail.com'];
const VALID_ROLES = ['super_admin', 'admin', 'supervisor', 'leader', 'staff', 'crew', 'driver'];
const JOB_ROLE_MAP = {
  'crew warehouse & distribusi': 'crew',
  driver: 'driver',
  leader: 'leader',
  'staff office': 'staff',
};

function isSuper(user) {
  if (!user) return false;
  if (user.role === 'super_admin') return true;
  return SUPER_EMAILS.includes(String(user.email || '').toLowerCase());
}

function requireAdmin(user) {
  if (!user) {
    const err = new Error('Unauthorized');
    err.status = 401;
    throw err;
  }
  if (!isSuper(user) && user.role !== 'admin') {
    const err = new Error('Forbidden');
    err.status = 403;
    throw err;
  }
}

export async function manageUsers(payload = {}) {
  const Users = entityApi('User');
  const UserRequests = entityApi('UserRequest');
  const action = payload.action;

  if (action === 'createRequest') {
    let email = String(payload.email || '').trim().toLowerCase();
    let fullName = String(payload.full_name || '').trim();
    if (!email) {
      try {
        const u = await authCompat.me();
        email = String(u?.email || '').trim().toLowerCase();
        if (!fullName) fullName = u?.full_name || '';
      } catch {
        // ignore
      }
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      const err = new Error('Email tidak valid');
      err.status = 400;
      throw err;
    }
    const requestedRole = VALID_ROLES.includes(payload.requested_role) ? payload.requested_role : 'crew';
    const existing = await UserRequests.filter({ email, status: 'pending' });
    if (existing && existing.length) return { ok: true, alreadyPending: true };
    await UserRequests.create({ email, full_name: fullName, requested_role: requestedRole, status: 'pending' });
    return { ok: true };
  }

  if (action === 'autoRegister') {
    let authUser;
    try {
      authUser = await authCompat.me();
    } catch {
      authUser = null;
    }
    if (!authUser) {
      const err = new Error('Unauthorized');
      err.status = 401;
      throw err;
    }
    const email = String(authUser.email || '').trim().toLowerCase();
    if (!email) {
      const err = new Error('Email tidak ditemukan');
      err.status = 400;
      throw err;
    }
    let fullName = String(payload.full_name || '').trim();
    if (!fullName) fullName = String(authUser.full_name || '').trim();
    const jobTitle = String(payload.job_title || '').trim();
    const roleKey = jobTitle.trim().toLowerCase();
    const assignedRole = JOB_ROLE_MAP[roleKey] || 'crew';
    const warehouses = Array.isArray(payload.warehouses)
      ? payload.warehouses.filter((w) => typeof w === 'string' && w.trim())
      : [];
    const existing = await Users.filter({ email });
    if (existing && existing.length) {
      const upd = { role: assignedRole };
      if (fullName) upd.display_name = fullName;
      if (jobTitle) upd.job_title = jobTitle;
      if (warehouses.length) upd.warehouses = warehouses;
      try {
        await Users.update(existing[0].id, upd);
      } catch {
        // ignore
      }
      return { ok: true, alreadyMember: true };
    }
    // No invite API client-side; create/update the caller's own profile row.
    try {
      await authCompat.updateMe({
        role: assignedRole,
        display_name: fullName || undefined,
        job_title: jobTitle || undefined,
        ...(warehouses.length ? { warehouses } : {}),
      });
    } catch {
      // ignore
    }
    return { ok: true };
  }

  if (action === 'deleteSelf') {
    const u = await authCompat.me();
    if (!u) {
      const err = new Error('Unauthorized');
      err.status = 401;
      throw err;
    }
    await Users.delete(u.id);
    await authCompat.logout();
    return { ok: true };
  }

  const user = await authCompat.me();
  requireAdmin(user);

  if (action === 'list') {
    const users = await Users.list();
    return {
      users: users.map((u) => ({
        id: u.id,
        full_name: u.full_name,
        display_name: u.display_name,
        email: u.email,
        role: u.role,
        job_title: u.job_title,
        last_active_at: u.last_active_at,
        warehouses: Array.isArray(u.warehouses) ? u.warehouses : [],
      })),
    };
  }

  if (action === 'listRequests') {
    const requests = await UserRequests.filter({ status: 'pending' }, '-created_date', 100);
    return { requests };
  }

  if (action === 'approveRequest') {
    const reqRec = await UserRequests.get(payload.requestId);
    if (!reqRec) {
      const err = new Error('Permintaan tidak ditemukan');
      err.status = 404;
      throw err;
    }
    const role = VALID_ROLES.includes(payload.role) ? payload.role : 'crew';
    if (!isSuper(user) && role === 'super_admin') {
      const err = new Error('Forbidden');
      err.status = 403;
      throw err;
    }
    const displayName = String(payload.full_name || reqRec.full_name || '').trim();
    try {
      const found = await Users.filter({ email: reqRec.email });
      if (found && found.length) await Users.update(found[0].id, { display_name: displayName, role });
    } catch {
      // user may not have signed up yet; role applies on autoRegister
    }
    await UserRequests.update(payload.requestId, { status: 'approved', requested_role: role, full_name: displayName });
    return { ok: true };
  }

  if (action === 'rejectRequest') {
    await UserRequests.update(payload.requestId, { status: 'rejected' });
    return { ok: true };
  }

  if (action === 'updateName') {
    const displayName = String(payload.full_name || '').trim();
    if (!displayName) {
      const err = new Error('Nama tidak boleh kosong');
      err.status = 400;
      throw err;
    }
    await Users.update(payload.userId, { display_name: displayName });
    return { ok: true };
  }

  if (action === 'updateRole') {
    if (!isSuper(user)) {
      const err = new Error('Forbidden');
      err.status = 403;
      throw err;
    }
    const { userId, newRole } = payload;
    if (!VALID_ROLES.includes(newRole)) {
      const err = new Error('Invalid role');
      err.status = 400;
      throw err;
    }
    await Users.update(userId, { role: newRole });
    return { ok: true };
  }

  if (action === 'updateWarehouses') {
    const { userId, warehouses } = payload;
    if (!userId) {
      const err = new Error('userId required');
      err.status = 400;
      throw err;
    }
    const whList = Array.isArray(warehouses) ? warehouses.filter((w) => typeof w === 'string' && w.trim()) : [];
    await Users.update(userId, { warehouses: whList });
    return { ok: true };
  }

  if (action === 'delete') {
    if (!isSuper(user)) {
      const err = new Error('Forbidden');
      err.status = 403;
      throw err;
    }
    await Users.delete(payload.userId);
    return { ok: true };
  }

  const err = new Error('Unknown action');
  err.status = 400;
  throw err;
}

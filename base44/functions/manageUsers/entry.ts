import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const SUPER_EMAILS = ["suhendra.a.d@gmail.com"];
const VALID_ROLES = ["super_admin", "admin", "supervisor", "leader", "staff", "crew", "driver"];
const JOB_ROLE_MAP: Record<string, string> = {
  "crew warehouse & distribusi": "crew",
  "driver": "driver",
  "leader": "leader",
  "staff office": "staff",
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const action = body.action;

    // Public action: any authenticated user may submit an access request, even before
    // being approved as a member (base44.auth.me() can fail for not-yet-registered users).
    if (action === "createRequest") {
      let email = (body.email || "").trim().toLowerCase();
      let fullName = (body.full_name || "").trim();
      if (!email) {
        try {
          const u = await base44.auth.me();
          email = (u?.email || "").trim().toLowerCase();
          if (!fullName) fullName = u?.full_name || "";
        } catch (_) {}
      }
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return Response.json({ error: "Email tidak valid" }, { status: 400 });
      const requestedRole = VALID_ROLES.includes(body.requested_role) ? body.requested_role : "crew";
      const existing = await base44.asServiceRole.entities.UserRequest.filter({ email, status: "pending" });
      if (existing && existing.length) return Response.json({ ok: true, alreadyPending: true });
      await base44.asServiceRole.entities.UserRequest.create({
        email, full_name: fullName, requested_role: requestedRole, status: "pending",
      });
      return Response.json({ ok: true });
    }

    if (action === "autoRegister") {
      // Require authentication — only the caller may register/modify their own account.
      let authUser;
      try { authUser = await base44.auth.me(); } catch (_) {}
      if (!authUser) return Response.json({ error: "Unauthorized" }, { status: 401 });
      const email = (authUser.email || "").trim().toLowerCase();
      if (!email) return Response.json({ error: "Email tidak ditemukan" }, { status: 400 });
      let fullName = (body.full_name || "").trim();
      if (!fullName) fullName = (authUser.full_name || "").trim();
      const jobTitle = (body.job_title || "").trim();
      const roleKey = (jobTitle || "").trim().toLowerCase();
      const assignedRole = JOB_ROLE_MAP[roleKey] || "crew";
      const warehouses = Array.isArray(body.warehouses) ? body.warehouses.filter((w: string) => typeof w === "string" && w.trim()) : [];
      const existing = await base44.asServiceRole.entities.User.filter({ email });
      if (existing && existing.length) {
        const upd: any = { role: assignedRole };
        if (fullName) upd.display_name = fullName;
        if (jobTitle) upd.job_title = jobTitle;
        if (warehouses.length) upd.warehouses = warehouses;
        try { await base44.asServiceRole.entities.User.update(existing[0].id, upd); } catch (_) {}
        return Response.json({ ok: true, alreadyMember: true });
      }
      try { await base44.users.inviteUser(email, assignedRole); } catch (_) {}
      let rec;
      try { const found = await base44.asServiceRole.entities.User.filter({ email }); rec = found && found[0]; } catch (_) {}
      if (!rec) { try { rec = await base44.asServiceRole.entities.User.create({ email, role: assignedRole, display_name: fullName || undefined, job_title: jobTitle || undefined, ...(warehouses.length ? { warehouses } : {}) }); } catch (_) {} }
      if (rec) { try { const upd: any = { role: assignedRole }; if (fullName) upd.display_name = fullName; if (jobTitle) upd.job_title = jobTitle; if (warehouses.length) upd.warehouses = warehouses; await base44.asServiceRole.entities.User.update(rec.id, upd); } catch (_) {} }
      return Response.json({ ok: true });
    }

    if (action === "deleteSelf") {
      const u = await base44.auth.me();
      if (!u) return Response.json({ error: "Unauthorized" }, { status: 401 });
      await base44.asServiceRole.entities.User.delete(u.id);
      return Response.json({ ok: true });
    }

    // Admin actions require a registered app user
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const isSuper = user.role === "super_admin" || SUPER_EMAILS.includes((user.email || "").toLowerCase());
    const isAdmin = user.role === "admin";
    if (!isSuper && !isAdmin) return Response.json({ error: "Forbidden" }, { status: 403 });

    if (action === "list") {
      const users = await base44.asServiceRole.entities.User.list();
      return Response.json({
        users: users.map((u) => ({
          id: u.id, full_name: u.full_name, display_name: u.display_name, email: u.email, role: u.role, job_title: u.job_title, last_active_at: u.last_active_at, warehouses: Array.isArray(u.warehouses) ? u.warehouses : [],
        })),
      });
    }

    if (action === "listRequests") {
      const requests = await base44.asServiceRole.entities.UserRequest.filter({ status: "pending" }, "-created_date", 100);
      return Response.json({ requests });
    }

    if (action === "approveRequest") {
      const reqRec = await base44.asServiceRole.entities.UserRequest.get(body.requestId);
      if (!reqRec) return Response.json({ error: "Permintaan tidak ditemukan" }, { status: 404 });
      let role = VALID_ROLES.includes(body.role) ? body.role : "crew";
      if (!isSuper && role === "super_admin") return Response.json({ error: "Forbidden" }, { status: 403 });
      const displayName = (body.full_name || reqRec.full_name || "").trim();
      try { await base44.users.inviteUser(reqRec.email, role); } catch (_) {}
      try {
        const found = await base44.asServiceRole.entities.User.filter({ email: reqRec.email });
        if (found && found.length) await base44.asServiceRole.entities.User.update(found[0].id, { display_name: displayName, role });
      } catch (_) {}
      await base44.asServiceRole.entities.UserRequest.update(body.requestId, {
        status: "approved", requested_role: role, full_name: displayName,
      });
      return Response.json({ ok: true });
    }

    if (action === "rejectRequest") {
      await base44.asServiceRole.entities.UserRequest.update(body.requestId, { status: "rejected" });
      return Response.json({ ok: true });
    }

    if (action === "updateName") {
      const displayName = (body.full_name || "").trim();
      if (!displayName) return Response.json({ error: "Nama tidak boleh kosong" }, { status: 400 });
      await base44.asServiceRole.entities.User.update(body.userId, { display_name: displayName });
      return Response.json({ ok: true });
    }

    if (action === "updateRole") {
      if (!isSuper) return Response.json({ error: "Forbidden" }, { status: 403 });
      const { userId, newRole } = body;
      if (!VALID_ROLES.includes(newRole)) return Response.json({ error: "Invalid role" }, { status: 400 });
      await base44.asServiceRole.entities.User.update(userId, { role: newRole });
      return Response.json({ ok: true });
    }

    if (action === "updateWarehouses") {
      if (!isSuper && !isAdmin) return Response.json({ error: "Forbidden" }, { status: 403 });
      const { userId, warehouses } = body;
      if (!userId) return Response.json({ error: "userId required" }, { status: 400 });
      const whList = Array.isArray(warehouses) ? warehouses.filter((w: string) => typeof w === "string" && w.trim()) : [];
      await base44.asServiceRole.entities.User.update(userId, { warehouses: whList });
      return Response.json({ ok: true });
    }

    if (action === "delete") {
      if (!isSuper) return Response.json({ error: "Forbidden" }, { status: 403 });
      await base44.asServiceRole.entities.User.delete(body.userId);
      return Response.json({ ok: true });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
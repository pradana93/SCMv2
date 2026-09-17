import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, Users, ChevronDown, Lock, Cloud, Search, Megaphone, ScrollText } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { isSuperAdmin } from "@/components/shipping/shippingUtils";
import { usePermissions, PERMISSION_GROUPS } from "@/components/shipping/usePermissions";
import RoleMultiSelect from "@/components/shipping/RoleMultiSelect";
import MasterUserList from "@/components/shipping/master/MasterUserList";
import AnnouncementManager from "@/components/shipping/AnnouncementManager";
import AuditLogPanel from "@/components/shipping/AuditLogPanel";
import AccurateSettings from "@/pages/AccurateSettings";
import PageBackButton from "@/components/PageBackButton";

export default function SuperAdmin() {
  const { user } = useAuth();
  const { can } = usePermissions();
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({ queryKey: ["permissions"], queryFn: () => base44.entities.FeaturePermission.list() });
  const [busy, setBusy] = useState("");
  const [section, setSection] = useState("access");
  const [searchPerm, setSearchPerm] = useState("");
  const [openGroups, setOpenGroups] = useState(() => {
    const m = new Map();
    PERMISSION_GROUPS.forEach((g) => m.set(g.group, false));
    return m;
  });

  const isSuper = isSuperAdmin(user);
  if (!can("page.super_admin")) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
        <Lock className="h-10 w-10 text-slate-300" />
        <p className="mt-3 text-lg font-semibold text-slate-700">Akses Dilarang</p>
        <p className="mt-1 text-sm text-slate-500">Halaman ini hanya untuk Super Admin.</p>
      </div>
    );
  }

  const recFor = (key) => data.find((p) => p.key === key);
  const arrOr = (a, fallback) => (Array.isArray(a) && a.length ? a : fallback);
  const rolesFor = (key) => arrOr(recFor(key)?.allowed_roles, ["crew", "admin", "super_admin"]);
  const viewRoles = (key) => arrOr(recFor(key)?.view_roles, rolesFor(key));
  const editRoles = (key) => arrOr(recFor(key)?.edit_roles, rolesFor(key));
  const deleteRoles = (key) => arrOr(recFor(key)?.delete_roles, ["super_admin"]);

  const apply = async (key, next, label, group) => {
    const rec = recFor(key);
    setBusy(key);
    try {
      if (rec) await base44.entities.FeaturePermission.update(rec.id, { allowed_roles: next });
      else await base44.entities.FeaturePermission.create({ key, label, group, allowed_roles: next });
      qc.invalidateQueries({ queryKey: ["permissions"] });
    } finally { setBusy(""); }
  };

  const applyOp = async (key, op, next, label, group) => {
    const rec = recFor(key);
    setBusy(key + op);
    try {
      if (rec) await base44.entities.FeaturePermission.update(rec.id, { [op]: next });
      else await base44.entities.FeaturePermission.create({ key, label, group, allowed_roles: next, [op]: next });
      qc.invalidateQueries({ queryKey: ["permissions"] });
    } finally { setBusy(""); }
  };

  const toggleGroup = (g) => setOpenGroups((m) => { const nm = new Map(m); nm.set(g, !nm.get(g)); return nm; });
  const qPerm = searchPerm.trim().toLowerCase();
  const filteredGroups = qPerm ? PERMISSION_GROUPS.map((g) => ({ ...g, items: g.items.filter((item) => item.label.toLowerCase().includes(qPerm) || item.key.toLowerCase().includes(qPerm)) })).filter((g) => g.items.length > 0) : PERMISSION_GROUPS;

  const tabs = [
    { key: "access", label: "Akses Fitur", icon: ShieldCheck, show: isSuper },
    { key: "users", label: "Pengguna", icon: Users, show: true },
    { key: "pengumuman", label: "Pengumuman", icon: Megaphone, show: isSuper },
    { key: "audit_log", label: "Audit Log", icon: ScrollText, show: isSuper },
    { key: "integrasi", label: "Integrasi", icon: Cloud, show: isSuper },
  ].filter((t) => t.show);

  return (
    <div>
      <div className="mb-5">
        <div className="mb-3"><PageBackButton /></div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Super Admin</h1>
        <p className="mt-1 text-sm text-slate-500">{isSuper ? "Atur hak akses fitur, kelola pengguna, dan konfigurasi integrasi." : "Kelola daftar pengguna aplikasi."}</p>
      </div>

      <div className="mb-5">
        <div className="flex gap-0.5 rounded-xl border border-slate-200 bg-white p-1 shadow-sm overflow-x-auto scrollbar-hide">
          {tabs.map((t) => (
            <button key={t.key} onClick={() => setSection(t.key)} className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition ${section === t.key ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}>
              <t.icon className="h-4 w-4" />{t.label}
            </button>
          ))}
        </div>
      </div>

      {section === "access" && isSuper && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-indigo-600" />
              <h2 className="text-base font-bold text-slate-800">Pengaturan Akses Detail</h2>
            </div>
            <p className="mt-1 text-xs text-slate-500">Pilih role yang diizinkan untuk setiap fitur. Super Admin selalu memiliki akses penuh.</p>
            <div className="relative mt-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={searchPerm} onChange={(e) => setSearchPerm(e.target.value)} placeholder="Cari fitur..." className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" />
            </div>
          </div>
          <div className="divide-y divide-slate-100">
            {filteredGroups.map((g) => {
              const isPageGroup = g.group === "Akses Halaman" || g.crud === true;
              const isOpen = qPerm ? true : openGroups.get(g.group);
              return (
                <div key={g.group}>
                  <button onClick={() => toggleGroup(g.group)} className="flex w-full items-center justify-between gap-2 px-5 py-3 text-left transition hover:bg-slate-50">
                    <span className="text-sm font-bold text-slate-700">{g.group}</span>
                    <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  </button>
                  {isOpen && (
                    <div className="space-y-2 px-5 pb-4">
                      {g.items.map((item) => {
                        if (isPageGroup) {
                          const isViewOnly = g.group === "Akses Halaman";
                          return (
                            <div key={item.key} className="rounded-xl border border-slate-200 px-3 py-2.5">
                              <p className="text-sm font-medium text-slate-700">{item.label}</p>
                              <p className="truncate text-[11px] text-slate-400">{item.key}</p>
                              {isViewOnly ? (
                                <div className="mt-2">
                                  <p className="mb-1 text-[11px] font-semibold text-slate-500">Lihat</p>
                                  <RoleMultiSelect value={viewRoles(item.key)} disabled={busy === item.key + "view_roles"} onChange={(n) => applyOp(item.key, "view_roles", n, item.label, g.group)} />
                                </div>
                              ) : (
                                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                                  <div>
                                    <p className="mb-1 text-[11px] font-semibold text-slate-500">Lihat</p>
                                    <RoleMultiSelect value={viewRoles(item.key)} disabled={busy === item.key + "view_roles"} onChange={(n) => applyOp(item.key, "view_roles", n, item.label, g.group)} />
                                  </div>
                                  <div>
                                    <p className="mb-1 text-[11px] font-semibold text-slate-500">Edit</p>
                                    <RoleMultiSelect value={editRoles(item.key)} disabled={busy === item.key + "edit_roles"} onChange={(n) => applyOp(item.key, "edit_roles", n, item.label, g.group)} />
                                  </div>
                                  <div>
                                    <p className="mb-1 text-[11px] font-semibold text-slate-500">Hapus</p>
                                    <RoleMultiSelect value={deleteRoles(item.key)} disabled={busy === item.key + "delete_roles"} onChange={(n) => applyOp(item.key, "delete_roles", n, item.label, g.group)} />
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        }
                        return (
                          <div key={item.key} className="flex flex-col gap-2 rounded-xl border border-slate-200 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-slate-700">{item.label}</p>
                              <p className="truncate text-[11px] text-slate-400">{item.key}</p>
                            </div>
                            <div className="w-full sm:w-64">
                              <RoleMultiSelect value={rolesFor(item.key)} disabled={busy === item.key} onChange={(n) => apply(item.key, n, item.label, g.group)} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {isLoading && <p className="px-5 py-3 text-xs text-slate-400">Memuat pengaturan...</p>}
        </div>
      )}

      {section === "users" && <MasterUserList />}

      {section === "pengumuman" && isSuper && <AnnouncementManager />}

      {section === "audit_log" && isSuper && <AuditLogPanel />}

      {section === "integrasi" && isSuper && <AccurateSettings embedded />}
    </div>
  );
}
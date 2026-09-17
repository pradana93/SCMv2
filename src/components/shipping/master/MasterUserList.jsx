import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Users, Pencil, Check, X, Search, ArrowDownUp } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { isSuperAdmin as isSuperAdminUser } from "@/components/shipping/shippingUtils";
import { usePermissions } from "../usePermissions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import ConfirmDeleteDialog from "./ConfirmDeleteDialog";
import { presenceStatus, formatLastOnline } from "../presenceUtils";
import WarehouseMultiSelect from "../WarehouseMultiSelect";

const ROLE_LABELS = { super_admin: "Super Admin", admin: "Admin", supervisor: "Supervisor", leader: "Leader", staff: "Staff", crew: "Crew", driver: "Driver" };
const invoke = (action, payload = {}) => base44.functions.invoke("manageUsers", { action, ...payload });

export default function MasterUserList() {
  const { user: me, checkUserAuth } = useAuth();
  const isSuper = isSuperAdminUser(me);
  const isAdmin = me?.role === "admin";
  const canManage = isSuper || isAdmin;
  const { can } = usePermissions();
  const canInvite = can("user.invite");
  const canChangeRole = can("user.change_role");
  const canDelete = can("user.delete");
  const canViewStatus = can("user.view_status");
  const canSetWarehouse = can("user.set_warehouse");
  const qc = useQueryClient();
  const { data = [], isLoading, isError } = useQuery({ queryKey: ["users"], queryFn: async () => { const res = await invoke("list"); return res.data.users; } });
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("crew");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState("");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("name_asc");
  const [selected, setSelected] = useState(new Set());
  const [confirmId, setConfirmId] = useState(null);
  const [confirmBulk, setConfirmBulk] = useState(false);
  const refresh = () => { qc.invalidateQueries({ queryKey: ["users"] }); };

  const inviteOptions = isSuper
    ? [{ value: "crew", label: "Crew" }, { value: "driver", label: "Driver" }, { value: "staff", label: "Staff" }, { value: "leader", label: "Leader" }, { value: "supervisor", label: "Supervisor" }, { value: "admin", label: "Admin" }, { value: "super_admin", label: "Super Admin" }]
    : [{ value: "crew", label: "Crew" }, { value: "driver", label: "Driver" }, { value: "staff", label: "Staff" }, { value: "leader", label: "Leader" }, { value: "supervisor", label: "Supervisor" }, { value: "admin", label: "Admin" }];

  const invite = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true); setMsg("");
    try { await base44.users.inviteUser(email.trim(), role); setMsg(`Undangan terkirim ke ${email.trim()}.`); setEmail(""); refresh(); }
    catch { setMsg("Gagal mengirim undangan."); }
    finally { setBusy(false); }
  };
  const changeRole = async (id, newRole) => { setBusy(true); try { await invoke("updateRole", { userId: id, newRole }); refresh(); } finally { setBusy(false); } };
  const saveWarehouses = async (id, warehouses) => { setBusy(true); try { await invoke("updateWarehouses", { userId: id, warehouses }); refresh(); } finally { setBusy(false); } };
  const remove = async (id) => { setBusy(true); try { await invoke("delete", { userId: id }); setSelected((p) => { const n = new Set(p); n.delete(id); return n; }); refresh(); } finally { setBusy(false); } };
  const removeMany = async () => {
    const ids = [...selected].filter((id) => id !== me.id);
    setConfirmBulk(false);
    if (!ids.length) return;
    setBusy(true);
    try { for (const id of ids) await invoke("delete", { userId: id }); setSelected(new Set()); refresh(); }
    finally { setBusy(false); }
  };
  const toggle = (id) => setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const selectableUsers = (data || []).filter((u) => u.id !== me.id);
  const allSelected = selectableUsers.length > 0 && selected.size === selectableUsers.length;
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(selectableUsers.map((u) => u.id)));
  const startEdit = (u) => { setEditId(u.id); setEditName(u.display_name || u.full_name || ""); };
  const cancelEdit = () => { setEditId(null); setEditName(""); };
  const saveName = async (id) => {
    if (!editName.trim()) return;
    const newName = editName.trim();
    setBusy(true);
    qc.setQueryData(["users"], (old) => (old || []).map((u) => (u.id === id ? { ...u, display_name: newName } : u)));
    cancelEdit();
    try { await invoke("updateName", { userId: id, full_name: newName }); refresh(); if (id === me.id) checkUserAuth(); }
    catch { refresh(); }
    finally { setBusy(false); }
  };

  const q = search.trim().toLowerCase();
  const nameOf = (u) => String(u.display_name || u.full_name || u.email || "");
  const roleRank = { super_admin: 0, admin: 1, supervisor: 2, leader: 3, staff: 4, crew: 5, driver: 6 };
  const sortedUsers = (data || [])
    .filter((u) => !q || String(u.display_name || u.full_name || "").toLowerCase().includes(q) || String(u.email || "").toLowerCase().includes(q))
    .sort((a, b) => {
      if (sortBy === "name_desc") return nameOf(b).localeCompare(nameOf(a), "id", { sensitivity: "base" });
      if (sortBy === "role_asc") return (roleRank[a.role] ?? 99) - (roleRank[b.role] ?? 99) || nameOf(a).localeCompare(nameOf(b), "id");
      if (sortBy === "role_desc") return (roleRank[b.role] ?? 99) - (roleRank[a.role] ?? 99) || nameOf(a).localeCompare(nameOf(b), "id");
      return nameOf(a).localeCompare(nameOf(b), "id", { sensitivity: "base" });
    });

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2"><Users className="h-5 w-5 text-indigo-600" /><h2 className="text-lg font-bold">Daftar Pengguna</h2></div>
      </div>
      {canInvite && <form onSubmit={invite} className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Email pengguna baru" className="flex-1 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" />
        <Select value={role} onValueChange={setRole}>
          <SelectTrigger className="w-full sm:w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>{inviteOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
        </Select>
        <button disabled={busy} className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"><Plus className="h-4 w-4" />Undang</button>
      </form>}
      {!canDelete && <p className="mt-2 text-xs text-slate-400">Anda dapat mengundang pengguna dan memberi nama. Perubahan role dan penghapusan pengguna hanya dapat dilakukan oleh Super Admin.</p>}
      {msg && <p className="mt-2 text-sm text-slate-600">{msg}</p>}
      {canDelete && selectableUsers.length > 0 && <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
        <label className="flex items-center gap-2 text-sm font-medium text-slate-600"><Checkbox checked={allSelected} onCheckedChange={toggleAll} />Pilih Semua</label>
        {selected.size > 0 && <button onClick={() => setConfirmBulk(true)} disabled={busy} className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" />Hapus Terpilih ({selected.size})</button>}
      </div>}
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nama atau email pengguna..." className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" />
        </div>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-full sm:w-[200px] gap-2"><ArrowDownUp className="h-4 w-4 text-slate-400" /><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="name_asc">Nama (A-Z)</SelectItem>
            <SelectItem value="name_desc">Nama (Z-A)</SelectItem>
            <SelectItem value="role_asc">Role (Naik)</SelectItem>
            <SelectItem value="role_desc">Role (Turun)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="mt-4 space-y-2">
        {isLoading ? <p className="text-sm text-slate-400">Memuat...</p> : isError ? <p className="text-sm text-red-600">Gagal memuat pengguna.</p> : !sortedUsers.length ? <p className="text-sm text-slate-400">Tidak ada pengguna yang cocok.</p> :
          sortedUsers.map((u) => (
            <div key={u.id} className="flex flex-col gap-2 rounded-xl border border-slate-200 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 flex-1">
                {editId === u.id ? (
                  <div className="flex items-center gap-2">
                    <input value={editName} onChange={(e) => setEditName(e.target.value)} autoFocus placeholder="Nama pengguna" onKeyDown={(e) => e.key === "Enter" && saveName(u.id)} className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" />
                    <button onClick={() => saveName(u.id)} disabled={busy} className="rounded-lg bg-indigo-600 p-1.5 text-white transition hover:bg-indigo-700 disabled:opacity-60"><Check className="h-4 w-4" /></button>
                    <button onClick={cancelEdit} className="rounded-lg bg-slate-100 p-1.5 text-slate-600 transition hover:bg-slate-200"><X className="h-4 w-4" /></button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    {canDelete && u.id !== me.id && <Checkbox checked={selected.has(u.id)} onCheckedChange={() => toggle(u.id)} />}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{u.display_name || u.full_name || u.email}</p>
                      <p className="truncate text-xs text-slate-400">{u.email}</p>
                      {u.job_title && <p className="truncate text-xs text-slate-400">{u.job_title}</p>}
                      {canSetWarehouse && (
                        <div className="mt-1.5 max-w-[280px]">
                          <WarehouseMultiSelect value={Array.isArray(u.warehouses) ? u.warehouses : []} onChange={(wh) => saveWarehouses(u.id, wh)} disabled={busy} showAll hideSelectAll className="h-8 text-xs" />
                        </div>
                      )}
                      {canViewStatus && (() => { const ps = presenceStatus(u.last_active_at); return (
                        <p className="mt-0.5 flex items-center gap-1.5 text-xs">
                          <span className={`inline-block h-2 w-2 rounded-full ${ps.dot}`} />
                          <span className={ps.text}>{ps.label}</span>
                          <span className="text-slate-400">· Last Online: {formatLastOnline(u.last_active_at)}</span>
                        </p>
                      ); })()}
                    </div>
                    {canManage && <button onClick={() => startEdit(u)} disabled={busy} title="Edit nama" className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-indigo-600 disabled:opacity-40"><Pencil className="h-3.5 w-3.5" /></button>}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                {canChangeRole ? (
                  <Select value={u.role} onValueChange={(r) => changeRole(u.id, r)} disabled={busy || u.id === me.id}>
                    <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="super_admin">Super Admin</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="supervisor">Supervisor</SelectItem>
                      <SelectItem value="leader">Leader</SelectItem>
                      <SelectItem value="staff">Staff</SelectItem>
                      <SelectItem value="crew">Crew</SelectItem>
                      <SelectItem value="driver">Driver</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{ROLE_LABELS[u.role] || u.role}</span>
                )}
                {canDelete && <button onClick={() => setConfirmId(u.id)} disabled={busy || u.id === me.id} className="rounded-lg p-1.5 text-red-600 transition hover:bg-red-50 disabled:opacity-40"><Trash2 className="h-4 w-4" /></button>}
              </div>
            </div>
          ))}
      </div>
      <ConfirmDeleteDialog open={!!confirmId} onClose={() => setConfirmId(null)} onConfirm={() => { const id = confirmId; setConfirmId(null); if (id) remove(id); }} />
      <ConfirmDeleteDialog open={confirmBulk} onClose={() => setConfirmBulk(false)} onConfirm={removeMany} count={selected.size} />
    </div>
  );
}
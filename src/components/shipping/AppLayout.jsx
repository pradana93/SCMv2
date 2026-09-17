import { useEffect, useState } from "react";
import { NavLink, Link } from "react-router-dom";
import KeepAliveOutlet from "./KeepAliveOutlet";
import { LayoutDashboard, PackageCheck, Settings2, Truck, FileDown, ShieldCheck, LogIn, UserCircle, Boxes, Factory, Inbox, Bell } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/AuthContext";
import { base44 } from "@/api/base44Client";
import { isSuperAdmin } from "./shippingUtils";
import { usePermissions } from "./usePermissions";
import { presenceStatus } from "./presenceUtils";
import ProfileDialog from "@/components/ProfileDialog";
import AnnouncementDialog from "@/components/shipping/AnnouncementDialog";
import { WarehouseFilterProvider } from "./WarehouseFilterContext";
import { DashboardDateProvider, ShipmentsDateProvider } from "./DateFilterContext";

const ROLE_LABELS = { super_admin: "Super Admin", admin: "Admin", supervisor: "Supervisor", leader: "Leader", staff: "Staff", crew: "Crew", driver: "Driver" };

const LINKS = [
{ to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, key: "dashboard", end: true },
{ to: "/pengiriman", label: "Pengiriman", icon: PackageCheck, key: "pengiriman" },
{ to: "/penerimaan", label: "Penerimaan", icon: Inbox, key: "penerimaan" },
{ to: "/produksi", label: "Produksi", icon: Factory, key: "production" },
{ to: "/stok", label: "Stok", icon: Boxes, key: "stock" },
{ to: "/admin", label: "Master Data", icon: Settings2, key: "master_data" },
{ to: "/report", label: "Report", icon: FileDown, key: "report" }];


export default function AppLayout() {
  const { user, publicMode } = useAuth();
  const { can } = usePermissions();
  const [profileOpen, setProfileOpen] = useState(false);
  const [announceOpen, setAnnounceOpen] = useState(false);
  const links = LINKS.filter((l) => can(`page.${l.key}`));
  const canSuperAdmin = can("page.super_admin");
  const statusLabel = user ? ROLE_LABELS[user.role] || user.role : "Public · Read Only";
  const canViewStatus = can("user.view_status");
  const [myLastActive, setMyLastActive] = useState(user?.last_active_at || null);
  useEffect(() => {
    if (!user) return;
    const tick = () => {const now = new Date().toISOString();setMyLastActive(now);base44.auth.updateMe({ last_active_at: now }).catch(() => {});};
    tick();
    const id = setInterval(tick, 120000);
    return () => clearInterval(id);
  }, [user?.id]);
  const myPresence = canViewStatus && user ? presenceStatus(myLastActive) : null;

  const { data: announcements = [] } = useQuery({
    queryKey: ["announcements", "active"],
    queryFn: () => base44.entities.Announcement.list("-created_date", 100),
    enabled: !!user,
    staleTime: 60000
  });
  const todayStr = new Date().toISOString().slice(0, 10);
  const readIds = new Set(Array.isArray(user?.read_announcement_ids) ? user.read_announcement_ids : []);
  const unreadCount = user ? announcements.filter((a) => a.status === "published" && (!a.start_date || a.start_date <= todayStr) && (!a.end_date || a.end_date >= todayStr) && (a.target_type === "all" || (a.target_user_ids || []).includes(user.id) || (a.target_user_emails || []).includes(user.email)) && !readIds.has(a.id)).length : 0;

  return <div className="min-h-screen bg-background text-foreground pb-24 sm:pb-28">
    <header className="sticky top-0 z-20 border-b border-border bg-card backdrop-blur" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6 opacity-100">
        <span className="rounded-xl bg-indigo-600 p-2 text-white"><Truck className="h-5 w-5" /></span>
        <div><p className="font-bold leading-tight text-2xl">Bangor SCM</p><p className="text-xs text-slate-500">Dashboard Monitoring</p></div>
        <div className="ml-auto flex items-center gap-3">
          {user ?
          <button onClick={() => setProfileOpen(true)} className="flex items-center gap-2 rounded-xl px-2 py-1 text-left transition hover:bg-slate-100" title="Ubah profil">
              <span className="relative shrink-0">
                <UserCircle className="h-7 w-7 text-slate-400" />
                {myPresence && <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-white ${myPresence.dot}`} title={myPresence.label} />}
              </span>
              <span className="min-w-0">
                <p className="truncate font-semibold text-slate-700 max-w-[160px] text-sm">{user.display_name || user.full_name || user.email}</p>
                <p className="text-[11px] text-slate-400">{statusLabel}</p>
                {myPresence && <p className={`text-[11px] font-medium ${myPresence.text}`}>{myPresence.label}</p>}
                {user.job_title && <p className="truncate text-[11px] text-slate-400 max-w-[160px]">{user.job_title}</p>}
              </span>
            </button> :
          publicMode ?
          <div className="text-right">
              <p className="text-xs font-semibold text-slate-700">Public</p>
              <p className="text-[11px] text-slate-400">{statusLabel}</p>
            </div> :
          null}
          {user &&
          <button onClick={() => setAnnounceOpen(true)} className="relative inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white p-2 text-slate-600 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600" title="Pengumuman"><Bell className="h-4 w-4" />{unreadCount > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">{unreadCount > 9 ? "9+" : unreadCount}</span>}</button>}
          {user && canSuperAdmin &&
          <Link to="/super-admin" className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600" title="Super Admin"><ShieldCheck className="h-4 w-4" /><span className="hidden sm:inline">Super Admin</span></Link>}
          {!user && publicMode && <Link to="/login" className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"><LogIn className="h-4 w-4" /><span className="hidden sm:inline">Masuk</span></Link>}
        </div>
      </div>
    </header>
    <main className="mx-auto max-w-6xl overflow-x-hidden px-4 py-7 sm:px-6 sm:py-10"><WarehouseFilterProvider><DashboardDateProvider><ShipmentsDateProvider><KeepAliveOutlet /></ShipmentsDateProvider></DashboardDateProvider></WarehouseFilterProvider></main>
    <nav className="fixed inset-x-0 bottom-0 z-30 flex justify-center" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div className="mb-3 flex max-w-[calc(100vw-1.5rem)] gap-1 overflow-x-auto rounded-2xl border border-border bg-card p-1.5 shadow-lg shadow-black/5 backdrop-blur scrollbar-hide sm:mb-5">
        {links.map(({ to, label, icon: Icon, end }) =>
        <NavLink key={to} to={to} end={end} className={({ isActive }) => `flex shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl px-3 py-1.5 text-[10px] font-semibold transition sm:flex-row sm:gap-1.5 sm:px-3.5 sm:py-2 sm:text-sm ${isActive ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/30" : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"}`}>
            <Icon className="h-4 w-4 shrink-0" /><span className="hidden sm:inline">{label}</span>
          </NavLink>
        )}
      </div>
    </nav>
    {profileOpen && <ProfileDialog onClose={() => setProfileOpen(false)} />}
    {announceOpen && <AnnouncementDialog open={announceOpen} onClose={() => setAnnounceOpen(false)} />}
  </div>;
}
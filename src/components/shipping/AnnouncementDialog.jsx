import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Megaphone, Pin, FileText, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function AnnouncementDialog({ open, onClose }) {
  const { user, checkUserAuth } = useAuth();
  const { data: announcements = [], isLoading } = useQuery({
    queryKey: ["announcements", "active"],
    queryFn: () => base44.entities.Announcement.list("-created_date", 100),
    enabled: !!open && !!user,
  });

  const visible = useMemo(() => {
    if (!user) return [];
    const todayStr = new Date().toISOString().slice(0, 10);
    return announcements
      .filter((a) => a.status === "published")
      .filter((a) => (!a.start_date || a.start_date <= todayStr) && (!a.end_date || a.end_date >= todayStr))
      .filter((a) => a.target_type === "all" || (a.target_user_ids || []).includes(user.id) || (a.target_user_emails || []).includes(user.email))
      .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
  }, [announcements, user]);

  const markAsRead = async () => {
    if (!user || !visible.length) return;
    const existing = Array.isArray(user.read_announcement_ids) ? user.read_announcement_ids : [];
    const newIds = visible.map((a) => a.id).filter((id) => !existing.includes(id));
    if (!newIds.length) return;
    try { await base44.auth.updateMe({ read_announcement_ids: [...existing, ...newIds] }); checkUserAuth?.(); } catch {}
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { markAsRead(); onClose(); } }}>
      <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Megaphone className="h-5 w-5 text-indigo-600" />Pengumuman</DialogTitle>
        </DialogHeader>
        {isLoading ? <p className="py-6 text-center text-sm text-slate-400">Memuat...</p> : !visible.length ? <p className="py-8 text-center text-sm text-slate-400">Tidak ada pengumuman aktif.</p> :
          <div className="space-y-3">
            {visible.map((a) => (
              <div key={a.id} className={`rounded-xl border p-4 ${a.pinned ? "border-indigo-200 bg-indigo-50/30 dark:bg-indigo-50/10 dark:border-indigo-200/40" : "border-slate-200 bg-white dark:bg-slate-800/40 dark:border-slate-700"}`}>
                <div className="flex items-start gap-2">
                  {a.pinned && <Pin className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" />}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-800">{a.title}</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{a.content}</p>
                    {a.attachment_url && <a href={a.attachment_url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline"><FileText className="h-3.5 w-3.5" />Lihat Lampiran</a>}
                    <p className="mt-2 text-[11px] text-slate-400">Periode: {a.start_date || "?"} → {a.end_date || "?"}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>}
      </DialogContent>
    </Dialog>
  );
}
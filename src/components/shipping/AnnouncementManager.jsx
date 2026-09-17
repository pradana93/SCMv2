import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Pencil, Megaphone, Search, FileText, X, Pin } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { usePermissions } from "@/components/shipping/usePermissions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { today } from "@/components/shipping/shippingUtils";

const invokeUsers = (action, payload = {}) => base44.functions.invoke("manageUsers", { action, ...payload });

export default function AnnouncementManager() {
  const { can, canDelete: canDeletePerm } = usePermissions();
  const canCreate = can("announcement.create");
  const canDelete = canDeletePerm("announcement.delete");
  const qc = useQueryClient();
  const { data: announcements = [], isLoading } = useQuery({ queryKey: ["announcements"], queryFn: () => base44.entities.Announcement.list("-created_date", 200) });
  const { data: usersData } = useQuery({ queryKey: ["users"], queryFn: async () => { const res = await invokeUsers("list"); return res.data.users; } });
  const users = usersData || [];

  const [search, setSearch] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [busy, setBusy] = useState(false);

  const refresh = () => qc.invalidateQueries({ queryKey: ["announcements"] });

  const filtered = announcements.filter((a) => !search.trim() || (a.title || "").toLowerCase().includes(search.toLowerCase()));

  const openCreate = () => { setEditing(null); setEditOpen(true); };
  const openEdit = (a) => { setEditing(a); setEditOpen(true); };

  const remove = async () => {
    if (!confirmId) return;
    setBusy(true);
    try { await base44.entities.Announcement.delete(confirmId); setConfirmId(null); refresh(); }
    finally { setBusy(false); }
  };

  const togglePin = async (a) => {
    await base44.entities.Announcement.update(a.id, { pinned: !a.pinned });
    refresh();
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2"><Megaphone className="h-5 w-5 text-indigo-600" /><h2 className="text-lg font-bold">Pengumuman</h2></div>
        {canCreate && <button onClick={openCreate} className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"><Plus className="h-4 w-4" />Buat Pengumuman</button>}
      </div>

      <div className="relative mt-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari pengumuman..." className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:bg-slate-800/60 dark:border-slate-700" />
      </div>

      <div className="mt-4 space-y-2">
        {isLoading ? <p className="text-sm text-slate-400">Memuat...</p> : !filtered.length ? <p className="text-sm text-slate-400">Belum ada pengumuman.</p> :
          filtered.map((a) => (
            <div key={a.id} className={`flex flex-col gap-2 rounded-xl border px-4 py-3 sm:flex-row sm:items-start sm:justify-between ${a.status === "draft" ? "border-slate-200 bg-slate-50" : "border-emerald-200 bg-emerald-50/30 dark:bg-emerald-50/10 dark:border-emerald-200/40"}`}>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  {a.pinned && <Pin className="h-3.5 w-3.5 text-indigo-600" />}
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${a.status === "draft" ? "bg-slate-200 text-slate-600" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-100/30"}`}>{a.status === "draft" ? "Draft" : "Published"}</span>
                  <p className="text-sm font-semibold text-slate-800">{a.title}</p>
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-slate-500">{a.content || "-"}</p>
                <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-slate-400">
                  <span>Target: {a.target_type === "all" ? "Semua Pengguna" : `${(a.target_user_emails || a.target_user_ids || []).length} Pengguna`}</span>
                  <span>·</span>
                  <span>Periode: {a.start_date || "?"} → {a.end_date || "?"}</span>
                  {a.attachment_url && <><span>·</span><a href={a.attachment_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-indigo-600 hover:underline"><FileText className="h-3 w-3" />Lampiran</a></>}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {canCreate && <button onClick={() => togglePin(a)} title={a.pinned ? "Unpin" : "Pin"} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-indigo-600"><Pin className="h-4 w-4" /></button>}
                {canCreate && <button onClick={() => openEdit(a)} title="Edit" className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-indigo-600"><Pencil className="h-3.5 w-3.5" /></button>}
                {canDelete && <button onClick={() => setConfirmId(a.id)} title="Hapus" className="rounded-lg p-1.5 text-red-600 transition hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" /></button>}
              </div>
            </div>
          ))}
      </div>

      {editOpen && <AnnouncementEditDialog editing={editing} users={users} onClose={() => { setEditOpen(false); setEditing(null); }} onSaved={() => { setEditOpen(false); setEditing(null); refresh(); }} />}
      <AlertDialog open={!!confirmId} onOpenChange={(o) => !o && setConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Hapus pengumuman ini?</AlertDialogTitle><AlertDialogDescription>Tindakan ini tidak dapat dibatalkan.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); remove(); }} disabled={busy} className="bg-red-600 text-white hover:bg-red-700">{busy ? "Menghapus..." : "Hapus"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function AnnouncementEditDialog({ editing, users, onClose, onSaved }) {
  const [title, setTitle] = useState(editing?.title || "");
  const [content, setContent] = useState(editing?.content || "");
  const [targetType, setTargetType] = useState(editing?.target_type || "all");
  const [targetUserIds, setTargetUserIds] = useState(editing?.target_user_ids || []);
  const [startDate, setStartDate] = useState(editing?.start_date || today());
  const [endDate, setEndDate] = useState(editing?.end_date || "");
  const [attachmentUrl, setAttachmentUrl] = useState(editing?.attachment_url || "");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const toggleUser = (u) => {
    setTargetUserIds((prev) => prev.includes(u.id) ? prev.filter((x) => x !== u.id) : [...prev, u.id]);
  };

  const handleUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setAttachmentUrl(file_url);
    } catch (e) {
      setError("Gagal mengupload file.");
    } finally {
      setUploading(false);
    }
  };

  const save = async (publish) => {
    setError("");
    if (!title.trim()) { setError("Judul wajib diisi."); return; }
    if (publish && !startDate) { setError("Tanggal mulai wajib diisi untuk publish."); return; }
    if (publish && !endDate) { setError("Tanggal selesai wajib diisi untuk publish."); return; }
    setSaving(true);
    try {
      const targetEmails = targetType === "specific_users" ? users.filter((u) => targetUserIds.includes(u.id)).map((u) => u.email) : [];
      const payload = {
        title: title.trim(),
        content: content.trim(),
        status: publish ? "published" : "draft",
        target_type: targetType,
        target_user_ids: targetType === "specific_users" ? targetUserIds : [],
        target_user_emails: targetType === "specific_users" ? targetEmails : [],
        start_date: startDate || null,
        end_date: endDate || null,
        attachment_url: attachmentUrl || null,
      };
      if (editing) await base44.entities.Announcement.update(editing.id, payload);
      else await base44.entities.Announcement.create(payload);
      onSaved();
    } catch (e) {
      setError(e?.message || "Gagal menyimpan.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Pengumuman" : "Buat Pengumuman"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <label className="block text-sm font-medium">Judul
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Judul pengumuman" className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:bg-slate-800/60 dark:border-slate-700" />
          </label>
          <label className="block text-sm font-medium">Konten
            <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={5} placeholder="Isi pengumuman..." className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:bg-slate-800/60 dark:border-slate-700" />
          </label>
          <div>
            <p className="text-sm font-medium">Target Penerima</p>
            <Select value={targetType} onValueChange={setTargetType}>
              <SelectTrigger className="mt-1.5 w-full rounded-xl border-slate-200"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Pengguna</SelectItem>
                <SelectItem value="specific_users">Pengguna Tertentu</SelectItem>
              </SelectContent>
            </Select>
            {targetType === "specific_users" && (
              <div className="mt-1.5 max-h-40 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 dark:bg-slate-800/60 dark:border-slate-700">
                {users.map((u) => (
                  <label key={u.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50">
                    <input type="checkbox" checked={targetUserIds.includes(u.id)} onChange={() => toggleUser(u)} className="h-4 w-4 rounded border-input" />
                    <span className="min-w-0 truncate">{u.display_name || u.full_name || u.email}</span>
                    <span className="ml-auto shrink-0 text-xs text-slate-400">{u.email}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm font-medium">Tanggal Mulai
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:bg-slate-800/60 dark:border-slate-700" />
            </label>
            <label className="block text-sm font-medium">Tanggal Selesai
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:bg-slate-800/60 dark:border-slate-700" />
            </label>
          </div>
          <div>
            <p className="text-sm font-medium">Lampiran (opsional)</p>
            {attachmentUrl ? (
              <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <FileText className="h-4 w-4 text-indigo-600" />
                <a href={attachmentUrl} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-sm text-indigo-600 hover:underline">{attachmentUrl.split("/").pop()}</a>
                <button onClick={() => setAttachmentUrl("")} className="rounded-lg p-1 text-red-600 hover:bg-red-50"><X className="h-3.5 w-3.5" /></button>
              </div>
            ) : (
              <input type="file" onChange={(e) => handleUpload(e.target.files?.[0])} disabled={uploading} className="mt-1.5 w-full text-sm text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-indigo-700" />
            )}
            {uploading && <p className="mt-1 text-xs text-slate-400">Mengupload...</p>}
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Batal</Button>
          <Button variant="secondary" onClick={() => save(false)} disabled={saving || uploading}>{saving ? "Menyimpan..." : "Simpan Draft"}</Button>
          <Button onClick={() => save(true)} disabled={saving || uploading}>{saving ? "Menyimpan..." : "Publish"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Check, X, Mail, UserCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function PendingRequestsDialog({ requests, onClose, onDone, canGrantSuper = false }) {
  const [busyId, setBusyId] = useState(null);
  const [edits, setEdits] = useState({});

  const editFor = (r) => edits[r.id] ?? { full_name: r.full_name || "", role: r.requested_role || "crew" };
  const updateEdit = (r, patch) => setEdits((p) => ({ ...p, [r.id]: { ...editFor(r), ...patch } }));

  const approve = async (r) => {
    const e = editFor(r);
    if (!e.full_name.trim()) return;
    setBusyId(r.id);
    try { await base44.functions.invoke("manageUsers", { action: "approveRequest", requestId: r.id, full_name: e.full_name.trim(), role: e.role }); onDone(); }
    finally { setBusyId(null); }
  };
  const reject = async (r) => {
    setBusyId(r.id);
    try { await base44.functions.invoke("manageUsers", { action: "rejectRequest", requestId: r.id }); onDone(); }
    finally { setBusyId(null); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Permintaan Akses Pending</DialogTitle>
          <DialogDescription>Tinjau nama dan role akses, lalu setujui atau tolak permintaan.</DialogDescription>
        </DialogHeader>
        <div className="mt-2 max-h-[65vh] space-y-3 overflow-y-auto">
          {requests.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">Tidak ada permintaan pending.</p>
          ) : requests.map((r) => {
            const e = editFor(r);
            return (
              <div key={r.id} className="rounded-xl border border-slate-200 px-4 py-3">
                <div className="flex items-center gap-2">
                  <UserCircle className="h-5 w-5 shrink-0 text-slate-400" />
                  <p className="truncate text-sm font-medium">{r.full_name || "(tanpa nama)"}</p>
                </div>
                <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-slate-400"><Mail className="h-3 w-3" />{r.email}</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <label className="text-xs font-medium text-slate-600">Display Name
                    <input value={e.full_name} onChange={(ev) => updateEdit(r, { full_name: ev.target.value })} placeholder="Nama tampilan" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" />
                  </label>
                  <label className="text-xs font-medium text-slate-600">Role Akses
                    <Select value={e.role} onValueChange={(v) => updateEdit(r, { role: v })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="crew">Crew</SelectItem>
                        <SelectItem value="staff">Staff</SelectItem>
                        <SelectItem value="supervisor">Supervisor</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                        {canGrantSuper && <SelectItem value="super_admin">Super Admin</SelectItem>}
                      </SelectContent>
                    </Select>
                  </label>
                </div>
                <div className="mt-3 flex justify-end gap-2">
                  <button onClick={() => reject(r)} disabled={!!busyId} className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-200 disabled:opacity-60"><X className="h-3.5 w-3.5" />Tolak</button>
                  <button onClick={() => approve(r)} disabled={!!busyId || !e.full_name.trim()} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"><Check className="h-3.5 w-3.5" />Approve</button>
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Trash2, KeyRound, Sun, Moon, Warehouse, LogOut } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { isSuperAdmin, ALL_WAREHOUSES } from "@/components/shipping/shippingUtils";

const getStoredTheme = () => {
  try { return localStorage.getItem("theme") || "light"; } catch { return "light"; }
};
const applyTheme = (t) => {
  try {
    if (t === "dark") document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  } catch {}
};

export default function ProfileDialog({ onClose }) {
  const { user, checkUserAuth, logout } = useAuth();
  const [name, setName] = useState(user?.display_name || user?.full_name || "");
  const [job, setJob] = useState(user?.job_title || "");
  const [selectedWh, setSelectedWh] = useState(Array.isArray(user?.warehouses) ? user.warehouses : []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdError, setPwdError] = useState("");
  const [pwdSuccess, setPwdSuccess] = useState("");
  const [theme, setTheme] = useState("light");
  const hasPassword = user?.has_password !== false;
  const isSuper = isSuperAdmin(user);

  const { data: warehouses = [] } = useQuery({ queryKey: ["warehouses"], queryFn: () => base44.entities.Warehouse.list() });
  const whList = warehouses.map((w) => w.name).slice().sort((a, b) => a.localeCompare(b, "id"));

  useEffect(() => { setTheme(getStoredTheme()); }, []);
  const switchTheme = (t) => {
    setTheme(t);
    try { localStorage.setItem("theme", t); } catch {}
    applyTheme(t);
  };

  const toggleWh = (w) => {
    setSelectedWh((prev) => prev.includes(w) ? prev.filter((x) => x !== w) : [...prev, w]);
  };

  const deleteAccount = async () => {
    setDeleting(true);
    try {
      await base44.functions.invoke("manageUsers", { action: "deleteSelf" });
      await logout();
    } catch (e) {
      setError(e?.message || "Gagal menghapus akun.");
      setDeleting(false);
      setShowDelete(false);
    }
  };

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const updates = { display_name: name.trim(), job_title: job.trim() };
      // Only update warehouses if user is not super admin (super admin always has all)
      if (!isSuper) {
        updates.warehouses = selectedWh;
      }
      await base44.auth.updateMe(updates);
      await checkUserAuth();
      onClose();
    } catch (e) {
      setError(e?.message || "Gagal menyimpan profil.");
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async () => {
    setPwdError("");
    setPwdSuccess("");
    if (newPwd !== confirmPwd) {
      setPwdError("Konfirmasi password baru tidak cocok.");
      return;
    }
    if (newPwd.length < 6) {
      setPwdError("Password baru minimal 6 karakter.");
      return;
    }
    setPwdSaving(true);
    try {
      await base44.auth.changePassword({ userId: user.id, ...(hasPassword ? { currentPassword: currentPwd } : {}), newPassword: newPwd });
      setPwdSuccess(hasPassword ? "Password berhasil diubah." : "Password berhasil dibuat.");
      setCurrentPwd("");
      setNewPwd("");
      setConfirmPwd("");
      setTimeout(() => { setShowPwd(false); setPwdSuccess(""); }, 2000);
    } catch (e) {
      if (e?.status === 401) setPwdError("Password saat ini tidak sesuai.");
      else if (e?.status === 422) setPwdError("Password baru tidak memenuhi syarat.");
      else setPwdError(e?.message || (hasPassword ? "Gagal mengubah password." : "Gagal membuat password."));
    } finally {
      setPwdSaving(false);
    }
  };

  const inputClass = "mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:bg-slate-800/60 dark:border-slate-700 dark:placeholder:text-slate-400";

  return (
    <>
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Profil Pengguna</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <label className="block text-sm font-medium">Nama
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama tampilan" className={inputClass} />
          </label>
          <label className="block text-sm font-medium">Fungsi Kerja
            <input value={job} onChange={(e) => setJob(e.target.value)} placeholder="contoh: Checker, Admin Gudang, Driver..." className={inputClass} />
          </label>
          <div>
            <p className="text-sm font-medium">Gudang Penempatan</p>
            {isSuper ? (
              <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm font-medium text-emerald-700 dark:bg-emerald-50/20 dark:border-emerald-200/50">
                <Warehouse className="h-4 w-4" /> {ALL_WAREHOUSES} (Super Admin)
              </div>
            ) : (
              <>
                <p className="mt-0.5 text-xs text-slate-400">Pilih gudang yang dapat Anda akses.</p>
                <div className="mt-1.5 max-h-40 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 dark:bg-slate-800/60 dark:border-slate-700">
                  {whList.length === 0 && <p className="px-2 py-1.5 text-xs text-slate-400">Belum ada data gudang.</p>}
                  {whList.map((w) => (
                    <label key={w} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50">
                      <input type="checkbox" checked={selectedWh.includes(w)} onChange={() => toggleWh(w)} className="h-4 w-4 rounded border-input" />
                      <span>{w}</span>
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>
          <p className="text-xs text-slate-400">Email: {user?.email || "-"}</p>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Batal</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Menyimpan..." : "Simpan"}</Button>
        </DialogFooter>
        <div className="border-t border-slate-100 pt-3">
          <Button variant="ghost" onClick={() => { setShowPwd(!showPwd); setPwdError(""); setPwdSuccess(""); }} className="w-full text-slate-700 hover:bg-slate-100"><KeyRound className="mr-2 h-4 w-4" />{showPwd ? (hasPassword ? "Batal Ubah Password" : "Batal Buat Password") : (hasPassword ? "Ubah Password" : "Buat Password")}</Button>
        </div>
        {showPwd && (
          <div className="space-y-3 border-t border-slate-100 pt-3">
            {!hasPassword && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">Akun Anda login via Google dan belum memiliki password. Buat password untuk dapat login dengan email & password.</p>}
            {hasPassword && (
              <label className="block text-sm font-medium">Password Saat Ini
                <input type="password" value={currentPwd} onChange={(e) => setCurrentPwd(e.target.value)} placeholder="Masukkan password lama" className={inputClass} />
              </label>
            )}
            <label className="block text-sm font-medium">Password Baru
              <input type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} placeholder="Minimal 6 karakter" className={inputClass} />
            </label>
            <label className="block text-sm font-medium">Konfirmasi Password Baru
              <input type="password" value={confirmPwd} onChange={(e) => setConfirmPwd(e.target.value)} placeholder="Ulangi password baru" className={inputClass} />
            </label>
            {pwdError && <p className="text-sm text-red-600">{pwdError}</p>}
            {pwdSuccess && <p className="text-sm text-emerald-600">{pwdSuccess}</p>}
            <Button onClick={changePassword} disabled={pwdSaving || (hasPassword && !currentPwd) || !newPwd || !confirmPwd} className="w-full">{pwdSaving ? "Menyimpan..." : (hasPassword ? "Simpan Password Baru" : "Buat Password")}</Button>
          </div>
        )}
        <div className="border-t border-slate-100 pt-3">
          <p className="mb-2 text-sm font-medium">Tema Tampilan</p>
          <div className="flex gap-2">
            <Button variant={theme === "light" ? "default" : "outline"} onClick={() => switchTheme("light")} className="flex-1 gap-2"><Sun className="h-4 w-4" />Terang</Button>
            <Button variant={theme === "dark" ? "default" : "outline"} onClick={() => switchTheme("dark")} className="flex-1 gap-2"><Moon className="h-4 w-4" />Gelap</Button>
          </div>
        </div>
        <div className="border-t border-slate-100 pt-3">
          <Button variant="ghost" onClick={() => setShowDelete(true)} className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"><Trash2 className="mr-2 h-4 w-4" />Hapus Akun</Button>
        </div>
        <div className="border-t border-slate-100 pt-3">
          <Button variant="ghost" onClick={() => logout()} className="w-full text-slate-700 hover:bg-slate-100"><LogOut className="mr-2 h-4 w-4" />Keluar</Button>
        </div>
      </DialogContent>
    </Dialog>
    <AlertDialog open={showDelete} onOpenChange={(o) => !o && setShowDelete(false)}>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>Hapus akun ini?</AlertDialogTitle><AlertDialogDescription>Akun dan data Anda akan dihapus permanen. Tindakan ini tidak dapat dibatalkan. Anda akan keluar otomatis setelah akun dihapus.</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Batal</AlertDialogCancel>
          <AlertDialogAction onClick={deleteAccount} disabled={deleting} className="bg-red-600 text-white hover:bg-red-700">{deleting ? "Menghapus..." : "Hapus Akun"}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
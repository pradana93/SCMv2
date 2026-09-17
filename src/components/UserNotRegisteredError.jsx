import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2, Send, Mail } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function UserNotRegisteredError() {
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("user");
  const [email, setEmail] = useState("");
  const [emailReady, setEmailReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const u = await base44.auth.me();
        if (active && u) {
          if (u.email) setEmail(u.email);
          if (!fullName && u.full_name) setFullName(u.full_name);
        }
      } catch (_) {}
      finally { if (active) setEmailReady(true); }
    })();
    return () => { active = false; };
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (!email.trim()) { setError("Email wajib diisi."); return; }
    setLoading(true);
    setError("");
    try {
      await base44.functions.invoke("manageUsers", {
        action: "createRequest",
        email: email.trim(),
        full_name: fullName,
        requested_role: role,
      });
      setDone(true);
    } catch (err) {
      setError(err?.message || "Gagal mengirim permintaan.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-white to-slate-50 px-4 py-10">
      <div className="w-full max-w-md rounded-lg border border-slate-100 bg-white p-8 shadow-lg">
        <div className="text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-orange-100">
            <svg className="h-8 w-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="mb-3 text-2xl font-bold text-slate-900">Akses Belum Disetujui</h1>
          <p className="text-sm text-slate-600">Akun Anda belum terdaftar sebagai pengguna aplikasi. Ajukan permintaan akses di bawah ini untuk ditinjau oleh admin.</p>
        </div>

        {done ? (
          <div className="mt-6 rounded-md bg-emerald-50 p-4 text-sm text-emerald-700">
            Permintaan akses terkirim. Admin akan meninjau dan menyetujui permintaan Anda. Silakan periksa email secara berkala untuk konfirmasi undangan.
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-3">
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email aktif Anda" type="email" required disabled={!emailReady} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 pl-9 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-50" />
            </div>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Nama lengkap" className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" />
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="user">Akses sebagai User</SelectItem>
                <SelectItem value="admin">Akses sebagai Admin</SelectItem>
              </SelectContent>
            </Select>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button type="submit" disabled={loading || !emailReady} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60">
              {loading ? <><Loader2 className="h-4 w-4 animate-spin" />Mengirim...</> : <><Send className="h-4 w-4" />Ajukan Permintaan</>}
            </button>
          </form>
        )}

        <div className="mt-6 border-t border-slate-100 pt-4 text-center">
          <button onClick={() => base44.auth.logout(window.location.href)} className="text-sm font-medium text-slate-500 transition hover:text-slate-700">Keluar</button>
        </div>
      </div>
    </div>
  );
}
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { isSuperAdmin } from "@/components/shipping/shippingUtils";
import { Database, Link2, Unlink, RefreshCw, LoaderCircle, CheckCircle2, AlertCircle, Cloud, CloudOff, Boxes, ArrowLeftRight, Settings2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import PageBackButton from "@/components/PageBackButton";

const call = (action, payload = {}) => base44.functions.invoke("accurateApi", { action, ...payload }).then((r) => r.data);

export default function AccurateSettings({ embedded = false }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [busy, setBusy] = useState("");
  const [dbs, setDbs] = useState([]);
  const [selectedDb, setSelectedDb] = useState("");
  const [msg, setMsg] = useState(null);
  const [syncResult, setSyncResult] = useState(null);

  const { data: status, isLoading } = useQuery({
    queryKey: ["accurateStatus"],
    queryFn: () => call("status"),
  });

  // Handle OAuth callback (?code=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (code) {
      setBusy("exchange");
      call("exchangeCode", { code }).then(() => {
        setMsg({ type: "success", text: "Otorisasi Accurate berhasil!" });
        qc.invalidateQueries({ queryKey: ["accurateStatus"] });
        window.history.replaceState({}, "", window.location.pathname);
      }).catch((e) => setMsg({ type: "error", text: e.response?.data?.error || e.message || "Gagal otorisasi" }))
        .finally(() => setBusy(""));
    }
  }, []);

  const connect = async () => {
    setBusy("connect");
    setMsg(null);
    try {
      const { authUrl } = await call("getAuthUrl");
      window.location.href = authUrl;
    } catch (e) {
      setMsg({ type: "error", text: e.response?.data?.error || "Gagal memulai koneksi. Pastikan ACCURATE_CLIENT_ID & ACCURATE_CLIENT_SECRET sudah diset di secrets." });
      setBusy("");
    }
  };

  const loadDbs = async () => {
    setBusy("dbList"); setMsg(null);
    try {
      const { dbs } = await call("dbList");
      setDbs(dbs || []);
      if (dbs?.length === 1) setSelectedDb(String(dbs[0].id));
    } catch (e) {
      setMsg({ type: "error", text: e.response?.data?.error || e.message });
    } finally { setBusy(""); }
  };

  const openDb = async () => {
    if (!selectedDb) return;
    setBusy("openDb"); setMsg(null);
    try {
      const r = await call("openDb", { db_id: Number(selectedDb) });
      setMsg({ type: "success", text: `Database "${r.alias}" berhasil dibuka.` });
      qc.invalidateQueries({ queryKey: ["accurateStatus"] });
    } catch (e) {
      setMsg({ type: "error", text: e.response?.data?.error || e.message });
    } finally { setBusy(""); }
  };

  const disconnect = async () => {
    setBusy("disconnect"); setMsg(null);
    try {
      await call("disconnect");
      setDbs([]); setSelectedDb("");
      setMsg({ type: "success", text: "Koneksi Accurate diputus." });
      qc.invalidateQueries({ queryKey: ["accurateStatus"] });
    } catch (e) { setMsg({ type: "error", text: e.response?.data?.error || e.message }); }
    finally { setBusy(""); }
  };

  const syncItems = async () => {
    setBusy("syncItems"); setMsg(null); setSyncResult(null);
    try {
      const r = await call("syncItems");
      setSyncResult(r);
      setMsg({ type: "success", text: `${r.results.filter((x) => x.ok).length} dari ${r.total} barang tersinkron.` });
    } catch (e) { setMsg({ type: "error", text: e.response?.data?.error || e.message }); }
    finally { setBusy(""); }
  };

  const syncMovements = async () => {
    setBusy("syncMovements"); setMsg(null); setSyncResult(null);
    try {
      const r = await call("syncMovements");
      setSyncResult(r);
      setMsg({ type: "success", text: `${r.synced} dari ${r.total} transaksi tersinkron.` });
      qc.invalidateQueries({ queryKey: ["accurateStatus"] });
    } catch (e) { setMsg({ type: "error", text: e.response?.data?.error || e.message }); }
    finally { setBusy(""); }
  };

  const toggleAutoSync = async (val) => {
    try { await call("setAutoSync", { auto_sync: val }); qc.invalidateQueries({ queryKey: ["accurateStatus"] }); } catch {}
  };

  const connected = status?.connected;
  const dbOpened = status?.dbOpened;
  const hasCredentials = status?.hasCredentials;

  return (
    <div>
      {!embedded && (
        <div className="mb-6">
          <div className="mb-3"><PageBackButton /></div>
          <p className="text-sm font-semibold text-indigo-600">Integrasi</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Accurate Online</h1>
          <p className="mt-2 text-sm text-slate-500">Hubungkan aplikasi ke Accurate Online untuk sinkronisasi otomatis barang & transaksi stok.</p>
        </div>
      )}

      {!hasCredentials && (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div className="text-sm text-amber-800">
              <p className="font-semibold">Kredensial API belum diset</p>
              <p className="mt-1">Daftarkan aplikasi di <a href="https://account.accurate.id/developer" target="_blank" rel="noreferrer" className="font-semibold underline">Accurate Developer Portal</a>, lalu set <code className="rounded bg-amber-100 px-1">ACCURATE_CLIENT_ID</code> & <code className="rounded bg-amber-100 px-1">ACCURATE_CLIENT_SECRET</code> di Settings → Secrets aplikasi ini. Setelah itu, tombol "Connect Accurate" akan aktif.</p>
            </div>
          </div>
        </div>
      )}

      <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <span className={`rounded-xl p-2.5 ${connected ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-400"}`}>
            {connected ? <Cloud className="h-6 w-6" /> : <CloudOff className="h-6 w-6" />}
          </span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-slate-700">Status Koneksi</p>
            {isLoading ? <p className="text-xs text-slate-400">Memeriksa...</p> :
              <p className="text-sm">
                <span className={`font-bold ${connected ? "text-emerald-600" : "text-slate-500"}`}>{connected ? "Terhubung" : "Belum Terhubung"}</span>
                {dbOpened && <span className="ml-2 text-slate-500">· Database: <b>{status?.setting?.db_alias || "-"}</b></span>}
              </p>
            }
            {status?.setting?.last_error && <p className="mt-1 text-xs text-rose-500">Error: {status.setting.last_error}</p>}
          </div>
          <div className="flex gap-2">
            {!connected ? (
              <Button onClick={connect} disabled={busy === "connect" || !hasCredentials} className="gap-1.5">
                {busy === "connect" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                Connect Accurate
              </Button>
            ) : (
              <Button onClick={disconnect} disabled={busy === "disconnect"} variant="outline" className="gap-1.5 text-rose-600 hover:bg-rose-50">
                {busy === "disconnect" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Unlink className="h-4 w-4" />}
                Putuskan
              </Button>
            )}
          </div>
        </div>
      </div>

      {connected && !dbOpened && (
        <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-indigo-600" />
            <p className="text-sm font-semibold text-slate-700">Pilih Database Accurate</p>
          </div>
          <p className="mt-1 text-xs text-slate-500">Buka salah satu database perusahaan Anda di Accurate Online.</p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <select value={selectedDb} onChange={(e) => setSelectedDb(e.target.value)} className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500">
              <option value="">— Pilih database —</option>
              {dbs.map((d) => <option key={d.id} value={d.id}>{d.alias} {d.expired ? "(expired)" : ""}</option>)}
            </select>
            <Button onClick={loadDbs} variant="outline" disabled={busy === "dbList"} className="gap-1.5">
              {busy === "dbList" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}Muat Daftar
            </Button>
            <Button onClick={openDb} disabled={busy === "openDb" || !selectedDb} className="gap-1.5">
              {busy === "openDb" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}Buka Database
            </Button>
          </div>
        </div>
      )}

      {dbOpened && (
        <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50/40 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              <p className="text-sm font-semibold text-emerald-700">Database Aktif: {status?.setting?.db_alias}</p>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={!!status?.setting?.auto_sync} onChange={(e) => toggleAutoSync(e.target.checked)} className="h-4 w-4 rounded" />
              Auto-sync transaksi
            </label>
          </div>
          {status?.setting?.last_sync_at && <p className="mt-1 text-xs text-slate-500">Sinkronisasi terakhir: {new Date(status.setting.last_sync_at).toLocaleString("id-ID")}</p>}
        </div>
      )}

      {dbOpened && (
        <div className="grid gap-3 sm:grid-cols-2">
          <button onClick={syncItems} disabled={!!busy} className="rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:shadow-md disabled:opacity-60">
            <Boxes className="h-6 w-6 text-indigo-600" />
            <p className="mt-2 text-sm font-bold text-slate-800">Sinkron Master Barang</p>
            <p className="mt-1 text-xs text-slate-500">Kirim semua data barang ke Accurate sebagai item INVENTORY.</p>
            <span className="mt-2 inline-block text-xs font-semibold text-indigo-600">{busy === "syncItems" ? "Memproses..." : "Mulai Sinkron →"}</span>
          </button>
          <button onClick={syncMovements} disabled={!!busy} className="rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:shadow-md disabled:opacity-60">
            <ArrowLeftRight className="h-6 w-6 text-emerald-600" />
            <p className="mt-2 text-sm font-bold text-slate-800">Sinkron Transaksi Stok</p>
            <p className="mt-1 text-xs text-slate-500">Kirim semua transaksi masuk/keluar yang belum tersinkron ke Accurate.</p>
            <span className="mt-2 inline-block text-xs font-semibold text-emerald-600">{busy === "syncMovements" ? "Memproses..." : "Mulai Sinkron →"}</span>
          </button>
        </div>
      )}

      {syncResult && (
        <div className="mt-4 max-h-72 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="mb-2 text-sm font-semibold text-slate-700">Hasil Sinkronisasi ({syncResult.results?.length || 0} item)</p>
          <div className="space-y-1">
            {(syncResult.results || []).map((r, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                {r.ok ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <AlertCircle className="h-3.5 w-3.5 text-rose-500" />}
                <span className="text-slate-700">{r.item || r.name}</span>
                {!r.ok && <span className="text-rose-500">— {r.error || r.reason}</span>}
                {r.skipped && <span className="text-amber-500">— {r.reason}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {msg && (
        <div className={`mt-4 rounded-xl p-3 text-sm ${msg.type === "success" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
          {msg.text}
        </div>
      )}
    </div>
  );
}
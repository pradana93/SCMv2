import { useMemo, useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Inbox, Pencil, Trash2, CheckCircle2, ClipboardList, Play, ShieldCheck, Clock, FileText, XCircle, LayoutList, ChevronRight } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { usePermissions } from "@/components/shipping/usePermissions";
import { isSuperAdmin } from "@/components/shipping/shippingUtils";
import { useStockCurrent } from "@/components/shipping/useStockCurrent";
import { useAutoSyncReceipts } from "@/components/shipping/useAutoSyncReceipts";
import { useUserWarehouses } from "@/components/shipping/useUserWarehouses";
import WarehouseMultiSelect from "@/components/shipping/WarehouseMultiSelect";
import DateRangeBar from "@/components/shipping/DateRangeBar";
import ConfirmDeleteDialog from "@/components/shipping/master/ConfirmDeleteDialog";
import ReceiptPlanDialog from "@/components/shipping/receipt/ReceiptPlanDialog";
import ReceiptReceiveDialog from "@/components/shipping/receipt/ReceiptReceiveDialog";
import ReceiptFinishDialog from "@/components/shipping/receipt/ReceiptFinishDialog";
import ReceiptVerifyDialog from "@/components/shipping/receipt/ReceiptVerifyDialog";
import ReceiptCompleteDialog from "@/components/shipping/receipt/ReceiptCompleteDialog";
import ReceiptSummaryDialog from "@/components/shipping/receipt/ReceiptSummaryDialog";
import ReceiptPlanDetailDialog from "@/components/shipping/receipt/ReceiptPlanDetailDialog";
import ProcessTimer from "@/components/shipping/ProcessTimer";
import { logActivity } from "@/components/shipping/auditLogShared";
import { useOutletEtaMap, getEtaDays } from "@/components/shipping/etaUtils";

const normKey = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const todayStr = () => new Date().toISOString().slice(0, 10);
const daysAgoStr = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
const formatDurationID = (seconds) => { if (!seconds || seconds <= 0) return "-"; const h = Math.floor(seconds / 3600); const m = Math.floor((seconds % 3600) / 60); const s = Math.floor(seconds % 60); const parts = []; if (h > 0) parts.push(`${h} jam`); if (m > 0) parts.push(`${m} menit`); if (s > 0) parts.push(`${s} detik`); return parts.join(", ") || "0 detik"; };
const formatTimeOnly = (ts) => { if (!ts) return "-"; try { return new Date(ts).toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", second: "2-digit" }); } catch { return ts; } };

const STATUS_META = {
  pending_confirmation: { label: "Menunggu Konfirmasi", className: "bg-orange-50 text-orange-700" },
  rencana: { label: "Rencana", className: "bg-amber-50 text-amber-700" },
  selesai: { label: "Selesai", className: "bg-emerald-50 text-emerald-700" },
  dalam_proses: { label: "Dalam Proses", className: "bg-blue-50 text-blue-700" },
  menunggu_verifikasi: { label: "Menunggu Verifikasi", className: "bg-violet-50 text-violet-700" },
  diterima: { label: "Diterima", className: "bg-emerald-50 text-emerald-700" },
  ditutup: { label: "Ditutup", className: "bg-slate-100 text-slate-500" },
};

export default function Penerimaan() {
  const { can, canEdit, canDelete } = usePermissions();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { items: stockItems, calcItemTonnage } = useStockCurrent();
  useAutoSyncReceipts();
  const { userWarehouses, hasAll } = useUserWarehouses();
  const [whFilter, setWhFilter] = useState(hasAll ? [] : userWarehouses);
  useEffect(() => { if (!hasAll && userWarehouses.length) setWhFilter(userWarehouses); }, [hasAll, userWarehouses]);
  const [dateFrom, setDateFrom] = useState(daysAgoStr(6));
  const [dateTo, setDateTo] = useState(todayStr());
  const [selectedIds, setSelectedIds] = useState(new Set());
  const { data: receipts = [], isLoading } = useQuery({ queryKey: ["receipts"], queryFn: () => base44.entities.Receipt.list("-arrival_date", 500) });
  const { data: receiptProcesses = [], isLoading: loadingProc } = useQuery({ queryKey: ["receiptProcesses"], queryFn: () => base44.entities.ReceiptProcess.list("-created_date", 500) });
  const { data: receiptVerifications = [], isLoading: loadingVerif } = useQuery({ queryKey: ["receiptVerifications"], queryFn: () => base44.entities.ReceiptVerification.list("-created_date", 500) });
  const { data: vendors = [] } = useQuery({ queryKey: ["vendors"], queryFn: () => base44.entities.Vendor.list() });

  const isAllWh = !whFilter || whFilter.length === 0;
  const inDateRange = (d) => (!dateFrom || (d || "") >= dateFrom) && (!dateTo || (d || "") <= dateTo);
  const pendingConfirmations = receipts.filter((r) => r.status === "pending_confirmation" && (isAllWh || whFilter.includes(r.warehouse)) && inDateRange(r.arrival_date) && (r.arrival_date || "") >= daysAgoStr(1));
  const filteredReceipts = receipts.filter((r) => r.status !== "pending_confirmation" && (isAllWh || whFilter.includes(r.warehouse)) && inDateRange(r.arrival_date));
  const filteredProcesses = receiptProcesses.filter((p) => (isAllWh || whFilter.includes(p.warehouse)) && inDateRange(p.arrival_date));
  const filteredVerifications = receiptVerifications.filter((v) => {
    const proc = v.process_id ? receiptProcesses.find((p) => p.id === v.process_id) : null;
    return (isAllWh || (proc && whFilter.includes(proc.warehouse))) && inDateRange(v.verified_date);
  });

  const canCreate = can("penerimaan.create");
  const canEditRec = canEdit("penerimaan.edit");
  const canDel = canDelete("penerimaan.delete");
  const canDelSelesai = canDelete("penerimaan.delete_selesai");
  const canAddVendor = can("master.vendor_add");
  const canVerify = can("penerimaan.verify");
  const userIsSuperAdmin = isSuperAdmin(user);

  const [tab, setTab] = useState("rencana");
  const [planOpen, setPlanOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [receiveRec, setReceiveRec] = useState(null);
  const [finishRec, setFinishRec] = useState(null);
  const [verifyRec, setVerifyRec] = useState(null);
  const [completeRec, setCompleteRec] = useState(null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const detailId = searchParams.get("receipt");
  const detailRec = detailId ? receipts.find((r) => r.id === detailId) : null;
  const openDetail = (r) => { const next = new URLSearchParams(searchParams); next.set("receipt", r.id); setSearchParams(next); };
  const closeDetail = () => { const next = new URLSearchParams(searchParams); next.delete("receipt"); setSearchParams(next, { replace: true }); };
  const [confirmId, setConfirmId] = useState(null);
  const [confirmType, setConfirmType] = useState("plan");
  const [confirmBulk, setConfirmBulk] = useState(false);
  const etaMap = useOutletEtaMap();
  const [busy, setBusy] = useState(false);

  const refresh = () => { qc.invalidateQueries({ queryKey: ["receipts"] }); qc.invalidateQueries({ queryKey: ["receiptProcesses"] }); qc.invalidateQueries({ queryKey: ["receiptVerifications"] }); qc.invalidateQueries({ queryKey: ["vendors"] }); qc.invalidateQueries({ queryKey: ["stockMovements"] }); qc.invalidateQueries({ queryKey: ["stockItems"] }); };
  const userName = user?.full_name || user?.email || "-";
  const addHistory = (rec, status, note) => [...(Array.isArray(rec?.status_history) ? rec.status_history : []), { status, timestamp: new Date().toISOString(), note, by: userName }];
  const vendorKeys = useMemo(() => new Set(vendors.map((v) => normKey(v.name))), [vendors]);
  const stockItemKeys = useMemo(() => new Set((stockItems || []).map((i) => normKey(i.name))), [stockItems]);

  const processesByReceipt = useMemo(() => {
    const map = new Map();
    for (const p of receiptProcesses) { if (!p.receipt_id) continue; if (!map.has(p.receipt_id)) map.set(p.receipt_id, []); map.get(p.receipt_id).push(p); }
    return map;
  }, [receiptProcesses]);

  const verificationsByProcess = useMemo(() => {
    const map = new Map();
    for (const v of receiptVerifications) { if (!v.process_id) continue; if (!map.has(v.process_id)) map.set(v.process_id, []); map.get(v.process_id).push(v); }
    return map;
  }, [receiptVerifications]);

  const getRemainingItems = (receipt) => {
    const procs = processesByReceipt.get(receipt.id) || [];
    const accumMap = new Map();
    for (const proc of procs) { for (const it of (proc.received_items || [])) { const k = normKey(it.item_name); const ex = accumMap.get(k) || { quantity: 0, tonnage: 0, unit: it.unit || "" }; ex.quantity += Number(it.quantity || 0); ex.tonnage += calcItemTonnage(it); accumMap.set(k, ex); } }
    return (receipt.items || []).map((it) => { const k = normKey(it.item_name); const planned = Number(it.quantity || 0); const received = accumMap.get(k)?.quantity || 0; return { ...it, received, remaining: Math.max(0, planned - received) }; });
  };

  const syncVendor = async (name) => { if (!name || vendorKeys.has(normKey(name))) return; try { await base44.entities.Vendor.create({ name }); } catch {} };
  const syncStockItems = async (items) => {
    const newItems = (items || []).filter((it) => it.item_name && it.unit && !stockItemKeys.has(normKey(it.item_name)));
    if (newItems.length) { await base44.entities.StockItem.bulkCreate(newItems.map((it) => ({ name: it.item_name, unit: it.unit }))); qc.invalidateQueries({ queryKey: ["stockItems"] }); }
  };

  const savePlan = async (payload) => {
    setBusy(true);
    try {
      if (editing) await base44.entities.Receipt.update(editing.id, payload);
      else await base44.entities.Receipt.create({ ...payload, status_history: [{ status: "rencana", timestamp: new Date().toISOString(), note: "Rencana dibuat", by: userName }] });
      logActivity(user, { action: editing ? "update" : "create", entity_type: "Receipt", entity_id: editing?.id || "", entity_name: payload.sender_name || "-", details: editing ? "Edit rencana kedatangan" : "Buat rencana kedatangan", module: "penerimaan" });
      try { await syncVendor(payload.sender_name); } catch {}
      try { await syncStockItems(payload.items); } catch {}
      setPlanOpen(false); setEditing(null); refresh();
    } finally { setBusy(false); }
  };

  const startProcess = async (payload) => {
    setBusy(true);
    try {
      const rec = receiveRec || {};
      await base44.entities.ReceiptProcess.create({
        receipt_id: rec.id, arrival_date: rec.arrival_date || new Date().toISOString().slice(0, 10),
        warehouse: rec.warehouse || "", sender_name: rec.sender_name || "",
        stock_keeper_name: payload.stock_keeper_name, crew_count: payload.crew_count,
        received_items: payload.received_items, note: payload.note, receive_start_ts: payload.receive_start_ts,
        status: "dalam_proses",
        status_history: [{ status: "dalam_proses", timestamp: new Date().toISOString(), note: "Mulai proses penerimaan", by: userName }],
      });
      logActivity(user, { action: "create", entity_type: "ReceiptProcess", entity_id: rec.id, entity_name: rec.sender_name || "-", details: "Mulai proses penerimaan", module: "penerimaan" });
      setReceiveRec(null); refresh();
    } finally { setBusy(false); }
  };

  const finishProcess = async (payload) => {
    setBusy(true);
    try {
      const rec = finishRec || {};
      const endTs = payload.receive_end_ts;
      const start = rec.receive_start_ts;
      const duration = start ? Math.floor((new Date(endTs).getTime() - new Date(start).getTime()) / 1000) : 0;
      await base44.entities.ReceiptProcess.update(payload.id, {
        status: "menunggu_verifikasi", receive_end_ts: endTs, receive_duration: duration,
        match_status: payload.match_status, surat_jalan_url: payload.surat_jalan_url, received_items: payload.received_items,
        status_history: addHistory(rec, "menunggu_verifikasi", `Proses penerimaan selesai - ${payload.match_status === "sesuai" ? "sesuai" : "tidak sesuai"}`),
      });
      logActivity(user, { action: "status_change", entity_type: "ReceiptProcess", entity_id: payload.id, entity_name: rec.sender_name || "-", details: "Proses penerimaan selesai", module: "penerimaan" });
      setFinishRec(null); refresh();
    } finally { setBusy(false); }
  };

  const verifyReceive = async (payload) => {
    setBusy(true);
    try {
      const rec = verifyRec || {};
      const items = (payload.received_items || []).filter((it) => it.item_name && Number(it.quantity) > 0);
      const verif = await base44.entities.ReceiptVerification.create({
        process_id: rec.id, receipt_id: rec.receipt_id || "",
        verified_by: payload.verified_by, verified_date: payload.verified_date,
        match_status: rec.match_status || "sesuai", surat_jalan_url: rec.surat_jalan_url || "",
        items, status: "diterima",
        status_history: [{ status: "diterima", timestamp: new Date().toISOString(), note: "Verifikasi diterima", by: userName }],
      });
      const ref = `ReceiptVerification: ${verif.id}`;
      const movements = items.map((it) => ({ item_name: it.item_name, type: "masuk", quantity: Number(it.quantity) || 0, unit: it.unit || "", warehouse: rec.warehouse || "Gudang Jakarta", note: `Penerimaan dari ${rec.sender_name || "-"}`, reference: ref, date: payload.verified_date || new Date().toISOString().slice(0, 10) }));
      if (movements.length) await base44.entities.StockMovement.bulkCreate(movements);
      logActivity(user, { action: "verify", entity_type: "ReceiptVerification", entity_id: verif.id, entity_name: rec.sender_name || "-", details: "Verifikasi penerimaan diterima", module: "penerimaan" });
      setVerifyRec(null); refresh();
      qc.invalidateQueries({ queryKey: ["stockMovements"] }); qc.invalidateQueries({ queryKey: ["stockItems"] });
    } finally { setBusy(false); }
  };

  const completeVerification = async (payload) => {
    setBusy(true);
    try {
      const rec = completeRec || {};
      await base44.entities.ReceiptVerification.update(payload.id, { status: "ditutup", complete_note: payload.complete_note, status_history: addHistory(rec, "ditutup", payload.complete_note || "Ditutup") });
      logActivity(user, { action: "status_change", entity_type: "ReceiptVerification", entity_id: payload.id, entity_name: rec.sender_name || "-", details: "Verifikasi ditutup", module: "penerimaan" });
      setCompleteRec(null); refresh();
    } finally { setBusy(false); }
  };

  const remove = async () => {
    if (confirmBulk) {
      setConfirmBulk(false);
      const ids = Array.from(selectedIds);
      if (!ids.length) return;
      setBusy(true);
      try {
        for (const id of ids) {
          const linkedProcs = receiptProcesses.filter((p) => p.receipt_id === id);
          for (const proc of linkedProcs) {
            const linkedVerifs = receiptVerifications.filter((v) => v.process_id === proc.id);
            for (const verif of linkedVerifs) { await base44.entities.StockMovement.deleteMany({ reference: `ReceiptVerification: ${verif.id}` }).catch(() => {}); await base44.entities.ReceiptVerification.delete(verif.id).catch(() => {}); }
            await base44.entities.ReceiptProcess.delete(proc.id).catch(() => {});
          }
          await base44.entities.Receipt.delete(id).catch(() => {});
        }
        setSelectedIds(new Set());
        refresh();
      } finally { setBusy(false); }
      return;
    }
    const id = confirmId; const type = confirmType; setConfirmId(null); setConfirmType("plan");
    if (!id) return;
    setBusy(true);
    try {
      if (type === "plan") {
        const linkedProcs = receiptProcesses.filter((p) => p.receipt_id === id);
        for (const proc of linkedProcs) {
          const linkedVerifs = receiptVerifications.filter((v) => v.process_id === proc.id);
          for (const verif of linkedVerifs) { await base44.entities.StockMovement.deleteMany({ reference: `ReceiptVerification: ${verif.id}` }).catch(() => {}); await base44.entities.ReceiptVerification.delete(verif.id).catch(() => {}); }
          await base44.entities.ReceiptProcess.delete(proc.id).catch(() => {});
        }
        await base44.entities.Receipt.delete(id);
      } else if (type === "process") {
        const linkedVerifs = receiptVerifications.filter((v) => v.process_id === id);
        for (const verif of linkedVerifs) { await base44.entities.StockMovement.deleteMany({ reference: `ReceiptVerification: ${verif.id}` }).catch(() => {}); await base44.entities.ReceiptVerification.delete(verif.id).catch(() => {}); }
        await base44.entities.ReceiptProcess.delete(id);
      } else if (type === "verification") {
        await base44.entities.StockMovement.deleteMany({ reference: `ReceiptVerification: ${id}` }).catch(() => {});
        await base44.entities.ReceiptVerification.delete(id);
      }
      refresh();
    } finally { setBusy(false); }
  };

  const renderItemRows = (items) => (Array.isArray(items) ? items : []).map((it, idx) => {
    const t = calcItemTonnage(it);
    return (
    <div key={idx} className="flex items-center justify-between gap-2 text-xs">
      <span className="min-w-0 truncate text-slate-700">{it.item_name}</span>
      <span className="shrink-0 font-semibold text-slate-800">{Number(it.quantity || 0).toLocaleString("id-ID")} {it.unit || ""}{t > 0 ? <span className="ml-1 text-slate-400">· {t.toLocaleString("id-ID", {maximumFractionDigits: 2})} kg</span> : null}</span>
    </div>
    );
  });

  const renderRemainingRows = (r) => getRemainingItems(r).filter((it) => it.remaining > 0 || it.received > 0).map((it, idx) => (
    <div key={idx} className="flex items-center justify-between gap-2 text-xs">
      <span className="min-w-0 truncate text-slate-700">{it.item_name}</span>
      <span className="shrink-0">
        {it.received > 0 && <span className="font-semibold text-emerald-600">{Number(it.received).toLocaleString("id-ID")} {it.unit || ""}</span>}
        {it.received > 0 && it.remaining > 0 && <span className="text-slate-400"> / </span>}
        {it.remaining > 0 && <span className="font-semibold text-rose-600">kurang {Number(it.remaining).toLocaleString("id-ID")} {it.unit || ""}</span>}
        {it.received === 0 && <span className="text-slate-500">{Number(it.quantity || 0).toLocaleString("id-ID")} {it.unit || ""}</span>}
      </span>
    </div>
  ));

  const StatusBadge = ({ status }) => { const m = STATUS_META[status] || { label: status, className: "bg-slate-100 text-slate-500" }; return <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${m.className}`}>{m.label}</span>; };

  const rencanaList = filteredReceipts;
  const prosesList = filteredProcesses.filter((p) => p.status === "dalam_proses");
  const verifikasiList = filteredProcesses.filter((p) => p.status === "menunggu_verifikasi" && !(verificationsByProcess.get(p.id) || []).some((v) => v.status === "diterima"));
  const selesaiList = filteredVerifications.filter((v) => v.status === "diterima");

  const confirmReceipt = async (id) => {
    setBusy(true);
    try {
      const rec = receipts.find((r) => r.id === id);
      if (!rec) return;
      await base44.entities.Receipt.update(id, { status: "rencana", note: (rec.note || "").replace("Menunggu konfirmasi dari", "Dikonfirmasi dari"), status_history: addHistory(rec, "rencana", "Dikonfirmasi dan masuk ke rencana kedatangan") });
      refresh();
    } finally { setBusy(false); }
  };

  const rejectReceipt = async (id) => {
    setBusy(true);
    try {
      await base44.entities.Receipt.delete(id);
      refresh();
    } finally { setBusy(false); }
  };

  const tabs = [
    { key: "konfirmasi", label: "Menunggu Konfirmasi", icon: Clock, count: pendingConfirmations.length },
    { key: "rencana", label: "Rencana Kedatangan", icon: ClipboardList, count: rencanaList.length },
    { key: "proses", label: "Proses Penerimaan", icon: Play, count: prosesList.length },
    { key: "verifikasi", label: "Menunggu Verifikasi", icon: ShieldCheck, count: verifikasiList.length },
    { key: "selesai", label: "Selesai", icon: CheckCircle2, count: selesaiList.length },
  ];

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-sm font-semibold text-indigo-600">Penerimaan</p><h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Manajemen Penerimaan</h1><p className="mt-2 text-sm text-slate-500">Kelola rencana kedatangan, proses penerimaan, dan verifikasi stok.</p></div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setSummaryOpen(true)} disabled={busy} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"><LayoutList className="h-4 w-4" />Ringkasan</button>
          {canCreate && tab === "rencana" && <button onClick={() => { setEditing(null); setPlanOpen(true); }} disabled={busy} className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"><Plus className="h-4 w-4" />Tambah Rencana Kedatangan</button>}
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <WarehouseMultiSelect value={whFilter} onChange={setWhFilter} className="w-full sm:w-[240px]" />
        <DateRangeBar dateFrom={dateFrom} dateTo={dateTo} onFromChange={setDateFrom} onToChange={setDateTo} />
      </div>

      <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm sm:flex sm:flex-wrap">
        {tabs.map((t) => <button key={t.key} onClick={() => setTab(t.key)} className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition sm:text-sm ${tab === t.key ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}><t.icon className="h-4 w-4 shrink-0" /><span className="text-center">{t.label}</span><span className={`ml-0.5 rounded-full px-1.5 py-0.5 text-[10px] ${tab === t.key ? "bg-white/20" : "bg-slate-100"}`}>{t.count}</span></button>)}
      </div>

      {isLoading ? <div className="flex justify-center py-16"><div className="h-7 w-7 animate-spin rounded-full border-4 border-indigo-100 border-t-indigo-600" /></div> :
        tab === "konfirmasi" ? (
          pendingConfirmations.length === 0 ? <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center"><Clock className="h-8 w-8 text-slate-300" /><p className="mt-3 text-sm text-slate-500">Tidak ada pengiriman yang menunggu konfirmasi.</p><p className="mt-1 text-xs text-slate-400">Pengiriman antar-gudang akan otomatis muncul di sini untuk dikonfirmasi.</p></div> :
          <div className="space-y-3">
            {pendingConfirmations.map((r) => (
              <div key={r.id} className="rounded-2xl border border-orange-200 bg-orange-50/30 p-4 shadow-sm sm:p-5 dark:bg-orange-50/10 dark:border-orange-200/40">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-orange-100 px-2.5 py-1 text-xs font-semibold text-orange-700 dark:bg-orange-100/30">Menunggu Konfirmasi</span>
                      <span className="text-sm font-semibold text-slate-700">{r.warehouse}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">Dari: {r.sender_name} · Tgl Estimasi: {r.arrival_date || "-"}</p>
                    {r.note && <p className="mt-0.5 text-xs text-slate-400">{r.note}</p>}
                    <div className="mt-2 space-y-1">{renderItemRows(r.items)}</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button onClick={() => confirmReceipt(r.id)} disabled={busy} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"><CheckCircle2 className="h-3.5 w-3.5" />Konfirmasi</button>
                    <button onClick={() => rejectReceipt(r.id)} disabled={busy} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-60"><XCircle className="h-3.5 w-3.5" />Tolak</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) :
        tab === "rencana" ? (
          rencanaList.length === 0 ? <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center"><ClipboardList className="h-8 w-8 text-slate-300" /><p className="mt-3 text-sm text-slate-500">Belum ada rencana kedatangan. {canCreate && "Klik Tambah Rencana Kedatangan untuk memulai."}</p></div> :
          <>
            {canDel && rencanaList.length > 0 && (
              <div className="mb-3 flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 dark:border-slate-700 dark:bg-slate-800/40">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300">
                  <input type="checkbox" checked={selectedIds.size === rencanaList.length && rencanaList.length > 0} onChange={(e) => setSelectedIds(e.target.checked ? new Set(rencanaList.map((r) => r.id)) : new Set())} className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                  Pilih Semua ({rencanaList.length})
                </label>
                {selectedIds.size > 0 && <button onClick={() => setConfirmBulk(true)} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"><Trash2 className="h-3.5 w-3.5" />Hapus {selectedIds.size} Terpilih</button>}
              </div>
            )}
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800/40">
              {rencanaList.map((r) => {
                const procs = processesByReceipt.get(r.id) || [];
                const remainingItems = getRemainingItems(r);
                const hasRemaining = remainingItems.some((it) => it.remaining > 0);
                const itemCount = (r.items || []).length;
                const etaDays = getEtaDays(etaMap, r.warehouse);
                const isSelected = selectedIds.has(r.id);
                return (
                  <div key={r.id} className={`flex items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0 dark:border-slate-700/50 ${isSelected ? "bg-indigo-50/40 dark:bg-indigo-950/20" : ""}`}>
                    {canDel && <input type="checkbox" checked={isSelected} onChange={(e) => { const next = new Set(selectedIds); if (e.target.checked) next.add(r.id); else next.delete(r.id); setSelectedIds(next); }} className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />}
                    <button onClick={() => openDetail(r)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                      <StatusBadge status={r.status} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{r.sender_name || "-"}</p>
                        <p className="truncate text-xs text-slate-400">{r.arrival_date || "-"} · {r.warehouse || "-"} · {itemCount} barang{procs.length > 0 ? ` · ${procs.length}× proses` : ""}{etaDays > 0 ? ` · ETA ${etaDays} hari` : ""}</p>
                      </div>
                      {procs.length === 0 ? <span className="hidden rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500 sm:inline">Menunggu Di Proses</span> : hasRemaining && <span className="hidden rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-600 sm:inline">Ada Sisa</span>}
                      <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
                    </button>
                    {canDel && <button onClick={() => { setConfirmId(r.id); setConfirmType("plan"); }} disabled={busy} className="rounded-lg p-1.5 text-red-600 transition hover:bg-red-50 dark:hover:bg-red-950/30" title="Hapus"><Trash2 className="h-3.5 w-3.5" /></button>}
                  </div>
                );
              })}
            </div>
          </>
        ) : tab === "proses" ? (
          loadingProc ? <div className="flex justify-center py-16"><div className="h-7 w-7 animate-spin rounded-full border-4 border-indigo-100 border-t-indigo-600" /></div> :
          prosesList.length === 0 ? <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center"><Play className="h-8 w-8 text-slate-300" /><p className="mt-3 text-sm text-slate-500">Belum ada proses penerimaan.</p></div> :
          <div className="grid gap-3 lg:grid-cols-2">
            {prosesList.map((p) => {
              const verifs = verificationsByProcess.get(p.id) || [];
              return (
                <div key={p.id} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0"><p className="truncate text-sm font-bold text-slate-800">{p.sender_name || "-"}</p><p className="text-xs text-slate-400">{p.arrival_date || "-"} · {p.warehouse || "-"}{p.stock_keeper_name ? ` · SK: ${p.stock_keeper_name}` : ""}{p.crew_count ? ` · Crew ${p.crew_count}` : ""}</p></div>
                    <StatusBadge status={p.status} />
                  </div>
                  {p.receive_start_ts && <div className="mt-2 flex items-center gap-2 rounded-xl bg-blue-50/50 px-3 py-2"><Clock className="h-4 w-4 text-blue-600" /><span className="text-xs text-slate-500">Durasi:</span><ProcessTimer start={p.receive_start_ts} end={p.receive_end_ts} mode="hms" /></div>}
                  {p.receive_start_ts && <p className="mt-1 text-[11px] text-slate-400">Mulai: {formatTimeOnly(p.receive_start_ts)}{p.receive_end_ts ? ` · Selesai: ${formatTimeOnly(p.receive_end_ts)}` : ""}</p>}
                  <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2"><p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Barang Diterima</p><div className="space-y-1">{renderItemRows(p.received_items)}</div></div>
                  {p.match_status && <p className="mt-2 text-xs text-slate-500">Status Data: <span className={`font-semibold ${p.match_status === "sesuai" ? "text-emerald-600" : "text-amber-600"}`}>{p.match_status === "sesuai" ? "Sesuai" : "Tidak Sesuai"}</span></p>}
                  {p.surat_jalan_url && <a href={p.surat_jalan_url} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-indigo-600 underline"><FileText className="h-3.5 w-3.5" />Lihat Surat Jalan</a>}
                  {p.note && <p className="mt-2 text-xs text-slate-500">Catatan: {p.note}</p>}
                  {verifs.length > 0 && (
                    <div className="mt-2 rounded-xl border border-slate-100 bg-slate-50/60 p-2.5">
                      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Verifikasi Terkait ({verifs.length})</p>
                      <div className="space-y-1">
                        {verifs.map((v, i) => (
                          <div key={v.id} className="flex items-center justify-between gap-2 text-xs">
                            <span className="text-slate-500">Verifikasi {i + 1}</span>
                            <span className="flex items-center gap-1.5"><span className="font-semibold text-slate-700">{v.verified_by || "-"}</span><StatusBadge status={v.status} /></span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="mt-3 flex flex-wrap items-center justify-end gap-1 border-t border-slate-100 pt-2">
                    {p.status === "dalam_proses" && canEditRec && <button onClick={() => setFinishRec(p)} disabled={busy} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" />Selesaikan Proses</button>}
                    {p.status === "menunggu_verifikasi" && canVerify && <button onClick={() => setVerifyRec(p)} disabled={busy} className="inline-flex items-center gap-1 rounded-lg bg-violet-600 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-violet-700"><ShieldCheck className="h-3.5 w-3.5" />Buat Verifikasi</button>}
                    {canDel && <button onClick={() => { setConfirmId(p.id); setConfirmType("process"); }} disabled={busy} className="rounded-lg p-1.5 text-red-600 transition hover:bg-red-50" title="Hapus"><Trash2 className="h-3.5 w-3.5" /></button>}
                  </div>
                </div>
              );
            })}
          </div>
        ) : tab === "verifikasi" ? (
          loadingVerif ? <div className="flex justify-center py-16"><div className="h-7 w-7 animate-spin rounded-full border-4 border-indigo-100 border-t-indigo-600" /></div> :
          verifikasiList.length === 0 ? <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center"><ShieldCheck className="h-8 w-8 text-slate-300" /><p className="mt-3 text-sm text-slate-500">Belum ada proses yang menunggu verifikasi.</p></div> :
          <div className="grid gap-3 lg:grid-cols-2">
            {verifikasiList.map((p) => {
              const verifs = verificationsByProcess.get(p.id) || [];
              const receipt = p.receipt_id ? receipts.find((r) => r.id === p.receipt_id) : null;
              return (
                <div key={p.id} className="flex flex-col rounded-2xl border border-violet-200 bg-violet-50/30 p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0"><p className="truncate text-sm font-bold text-slate-800">{p.sender_name || "-"}</p><p className="text-xs text-slate-400">{p.arrival_date || "-"} · {p.warehouse || "-"}{p.stock_keeper_name ? ` · SK: ${p.stock_keeper_name}` : ""}</p></div>
                    <StatusBadge status={p.status} />
                  </div>
                  {receipt?.note && <p className="mt-1 text-xs text-slate-500">Catatan Rencana: {receipt.note}</p>}
                  {p.receive_start_ts && <div className="mt-2 flex items-center gap-2 rounded-xl bg-blue-50/50 px-3 py-2"><Clock className="h-4 w-4 text-blue-600" /><span className="text-xs text-slate-500">Durasi:</span><ProcessTimer start={p.receive_start_ts} end={p.receive_end_ts} mode="hms" /></div>}
                  {p.receive_start_ts && <p className="mt-1 text-[11px] text-slate-400">Mulai: {formatTimeOnly(p.receive_start_ts)}{p.receive_end_ts ? ` · Selesai: ${formatTimeOnly(p.receive_end_ts)}` : ""}{p.receive_duration > 0 ? ` · ${formatDurationID(p.receive_duration)}` : ""}</p>}
                  {p.note && <p className="mt-1 text-xs text-slate-500">Catatan Penerimaan: {p.note}</p>}
                  <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2"><p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Barang Diterima</p><div className="space-y-1">{renderItemRows(p.received_items)}</div></div>
                  {p.match_status && <p className="mt-2 text-xs text-slate-500">Status Data: <span className={`font-semibold ${p.match_status === "sesuai" ? "text-emerald-600" : "text-amber-600"}`}>{p.match_status === "sesuai" ? "Sesuai" : "Tidak Sesuai"}</span></p>}
                  {p.surat_jalan_url && <a href={p.surat_jalan_url} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-indigo-600 underline"><FileText className="h-3.5 w-3.5" />Lihat Surat Jalan</a>}
                  {verifs.length > 0 && (
                    <div className="mt-2 rounded-xl border border-emerald-100 bg-emerald-50/40 p-2.5">
                      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-500">Verifikasi Sudah Dibuat ({verifs.length})</p>
                      <div className="space-y-1">
                        {verifs.map((v, i) => (
                          <div key={v.id} className="flex items-center justify-between gap-2 text-xs">
                            <span className="text-slate-500">Verifikasi {i + 1}</span>
                            <span className="flex items-center gap-1.5"><span className="font-semibold text-slate-700">{v.verified_by || "-"}</span><StatusBadge status={v.status} /></span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="mt-3 flex flex-wrap items-center justify-end gap-1 border-t border-slate-100 pt-2">
                    {canVerify && <button onClick={() => setVerifyRec(p)} disabled={busy} className="inline-flex items-center gap-1 rounded-lg bg-violet-600 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-violet-700"><ShieldCheck className="h-3.5 w-3.5" />{verifs.length > 0 ? "Buat Verifikasi Lagi" : "Buat Verifikasi"}</button>}
                    {canDel && <button onClick={() => { setConfirmId(p.id); setConfirmType("process"); }} disabled={busy} className="rounded-lg p-1.5 text-red-600 transition hover:bg-red-50" title="Hapus"><Trash2 className="h-3.5 w-3.5" /></button>}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          loadingVerif ? <div className="flex justify-center py-16"><div className="h-7 w-7 animate-spin rounded-full border-4 border-indigo-100 border-t-indigo-600" /></div> :
          selesaiList.length === 0 ? <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center"><CheckCircle2 className="h-8 w-8 text-slate-300" /><p className="mt-3 text-sm text-slate-500">Belum ada penerimaan selesai.</p></div> :
          <div className="grid gap-3 lg:grid-cols-2">
            {selesaiList.map((v) => {
              const proc = v.process_id ? receiptProcesses.find((p) => p.id === v.process_id) : null;
              const receipt = proc?.receipt_id ? receipts.find((r) => r.id === proc.receipt_id) : null;
              return (
                <div key={v.id} className="flex flex-col rounded-2xl border border-emerald-200 bg-emerald-50/30 p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0"><p className="truncate text-sm font-bold text-slate-800">{proc?.sender_name || "-"}</p><p className="text-xs text-slate-400">Verifikasi {v.verified_date || "-"} · {v.verified_by || "-"}</p></div>
                    <StatusBadge status={v.status} />
                  </div>
                  {proc && <p className="mt-1 text-xs text-indigo-500">Proses: {proc.arrival_date || "-"} · {proc.warehouse || "-"}</p>}
                  {receipt?.note && <p className="mt-1 text-xs text-slate-500">Catatan Rencana: {receipt.note}</p>}
                  {proc && (() => { const allProcs = processesByReceipt.get(proc.receipt_id) || [proc]; return (
                    <div className="mt-2 rounded-xl bg-blue-50/50 px-3 py-2 space-y-1">
                      {allProcs.length > 1 ? allProcs.map((pr, i) => (
                        <div key={pr.id} className="flex items-center justify-between gap-2 text-xs">
                          <span className="text-slate-500">Proses {i + 1}</span>
                          <span className="text-slate-600">{formatTimeOnly(pr.receive_start_ts)} - {formatTimeOnly(pr.receive_end_ts)}{pr.receive_duration > 0 ? ` · ${formatDurationID(pr.receive_duration)}` : ""}</span>
                        </div>
                      )) : (
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="text-slate-500">Waktu Proses</span>
                          <span className="text-slate-600">{formatTimeOnly(proc.receive_start_ts)} - {formatTimeOnly(proc.receive_end_ts)}{proc.receive_duration > 0 ? ` · ${formatDurationID(proc.receive_duration)}` : ""}</span>
                        </div>
                      )}
                    </div>
                  ); })()}
                  {proc?.note && <p className="mt-1 text-xs text-slate-500">Catatan Penerimaan: {proc.note}</p>}
                  {(() => { const ts = v.status_history?.find(h => h.status === "diterima")?.timestamp; return ts ? <p className="mt-1 text-[11px] text-slate-400">Diverifikasi pada: {formatTimeOnly(ts)}</p> : null; })()}
                  <div className="mt-3 rounded-xl bg-emerald-50/50 px-3 py-2"><p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-500">Barang Masuk Stok</p><div className="space-y-1">{renderItemRows(v.items)}</div></div>
                  {v.surat_jalan_url && <a href={v.surat_jalan_url} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-indigo-600 underline"><FileText className="h-3.5 w-3.5" />Lihat Surat Jalan</a>}
                  {v.complete_note && <p className="mt-2 text-xs text-amber-600">Catatan Verifikasi: {v.complete_note}</p>}
                  <div className="mt-3 flex flex-wrap items-center justify-end gap-1 border-t border-slate-100 pt-2">
                    <div className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700"><ShieldCheck className="h-3.5 w-3.5" />Sudah Diverifikasi</div>
                    {canDelSelesai && <button onClick={() => { setConfirmId(v.id); setConfirmType("verification"); }} disabled={busy} className="rounded-lg p-1.5 text-red-600 transition hover:bg-red-50" title="Hapus"><Trash2 className="h-3.5 w-3.5" /></button>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

      <ReceiptPlanDialog open={planOpen} onClose={() => { setPlanOpen(false); setEditing(null); }} onSave={savePlan} editing={editing} busy={busy} canAddVendor={canAddVendor} />
      <ReceiptReceiveDialog open={!!receiveRec} onClose={() => setReceiveRec(null)} onSave={startProcess} record={receiveRec} processes={receiveRec ? (processesByReceipt.get(receiveRec.id) || []) : []} busy={busy} />
      <ReceiptFinishDialog open={!!finishRec} onClose={() => setFinishRec(null)} onSave={finishProcess} record={finishRec} busy={busy} isSuperAdmin={userIsSuperAdmin} />
      <ReceiptVerifyDialog open={!!verifyRec} onClose={() => setVerifyRec(null)} onSave={verifyReceive} record={verifyRec} busy={busy} currentUser={user} />
      <ReceiptCompleteDialog open={!!completeRec} onClose={() => setCompleteRec(null)} onSave={completeVerification} record={completeRec} busy={busy} />
      <ReceiptSummaryDialog open={summaryOpen} onClose={() => setSummaryOpen(false)} receipts={receipts} processes={receiptProcesses} verifications={receiptVerifications} />
      <ReceiptPlanDetailDialog open={!!detailRec} onClose={closeDetail} record={detailRec} remainingItems={detailRec ? getRemainingItems(detailRec) : []} processes={detailRec ? (processesByReceipt.get(detailRec.id) || []) : []} canEdit={canEditRec} canDelete={canDel} hasRemaining={detailRec ? getRemainingItems(detailRec).some((it) => it.remaining > 0) : false} isAutoCreated={!!detailRec?.source_shipment_id} onEdit={() => { const r = detailRec; closeDetail(); setEditing(r); setPlanOpen(true); }} onDelete={() => { const id = detailRec?.id; closeDetail(); if (id) { setConfirmId(id); setConfirmType("plan"); } }} onReceive={() => { const r = detailRec; closeDetail(); if (r) setReceiveRec(r); }} />
      <ConfirmDeleteDialog open={!!confirmId || confirmBulk} onClose={() => { setConfirmId(null); setConfirmBulk(false); }} onConfirm={remove} count={confirmBulk ? selectedIds.size : 1} />
    </div>
  );
}
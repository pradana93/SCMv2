import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Truck, CircleCheck, ChevronDown, FileText, Trash2, Lock, Package, ClipboardList, Clock3, CalendarClock, CalendarCheck } from "lucide-react";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { formatTonnage, formatTimestamp, statusMeta, accuracyMeta, today, menungguStartTime } from "./shippingUtils";
import DoDetailDialog from "./DoDetailDialog";
import AccuracyDialog from "./AccuracyDialog";
import ProcessConfirmDialog from "./ProcessConfirmDialog";
import ProcessTimer from "./ProcessTimer";
import { STEPS, TARGET_TO_POPUP, SELESAI_TARGET, SELESAI_LABEL, POPUPS, RESET_FIELDS } from "./processFlowConfig";
import { useOutletEtaMap, computeEstimatedArrival, getEtaDays } from "./etaUtils";
import ActualArrivalDialog from "./ActualArrivalDialog";
import EditEtaDialog from "./EditEtaDialog";
import { usePermissions } from "./usePermissions";
import { useUserWarehouses } from "./useUserWarehouses";
import { useAuth } from "@/lib/AuthContext";
import { logActivity } from "@/components/shipping/auditLogShared";

const MANUAL_STEPS = STEPS.filter((s) => s !== "menunggu_packing" && s !== "menunggu_loading");

export default function ShipmentList({ shipments, loading, onUpdate, onDelete, onDeleteMany, canDelete = true, canReset = false, isSuper = false, canEditStatus = true }) {
  const [busyId, setBusyId] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [deleting, setDeleting] = useState(false);
  const [confirmId, setConfirmId] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const doId = searchParams.get("do");
  const doItem = doId ? shipments.find((s) => s.id === doId) : null;
  const openDo = (item) => { const next = new URLSearchParams(searchParams); next.set("do", item.id); setSearchParams(next); };
  const closeDo = () => { const next = new URLSearchParams(searchParams); next.delete("do"); setSearchParams(next, { replace: true }); };
  const [confirmBulk, setConfirmBulk] = useState(false);
  const [accuracyId, setAccuracyId] = useState(null);
  const [confirmProcess, setConfirmProcess] = useState(null);
  const [rescheduleItem, setRescheduleItem] = useState(null);
  const [actualArrivalItem, setActualArrivalItem] = useState(null);
  const etaMap = useOutletEtaMap();
  const { canEdit: canEditPerm } = usePermissions();
  const canEditEta = canEditPerm("pengiriman.edit_eta");
  const { allowedWarehouses } = useUserWarehouses();
  const { user } = useAuth();
  const appendHistory = (item, status, note) => {
    const userName = user?.full_name || user?.email || "Unknown";
    const history = Array.isArray(item?.status_history) ? [...item.status_history] : [];
    history.push({ status, timestamp: new Date().toISOString(), by: userName, note });
    return history;
  };
  const [etaEditOutlet, setEtaEditOutlet] = useState(null);
  const accuracyItem = shipments.find((item) => item.id === accuracyId);

  const isLocked = (item) => item.delivery_date < today();
  // Restrict processing actions to user's assigned warehouses
  const canModifyItem = (item) => !allowedWarehouses || allowedWarehouses.includes(item.warehouse);

  const doChangeStatus = async (item, target, values = {}) => {
    const now = new Date().toISOString();
    let payload = { status: target, ...values };
    if (target === "menunggu_antrian") {
      payload = { status: target, ...RESET_FIELDS };
    } else if (target === "proses_picking") {
      payload.timestamp_proses_picking = now;
    } else if (target === "menunggu_packing") {
      payload.timestamp_proses_picking_end = now;
    } else if (target === "proses_packing") {
      payload.timestamp_proses_packing = now;
      if (values.packing_checker_name) payload.checker_name = values.packing_checker_name;
      if (values.packing_crew_count != null) payload.crew_count = Number(values.packing_crew_count);
    } else if (target === "menunggu_loading") {
      payload.timestamp_proses_packing_end = now;
    } else if (target === "proses_loading") {
      payload.timestamp_proses_loading = now;
    } else if (target === "sudah_dikirim") {
      payload.timestamp_proses_loading_end = now;
      payload.timestamp_sudah_dikirim = now;
      if (!item.accuracy) payload.accuracy = "data_belum_tersedia";
    }
    payload.status_history = appendHistory(item, target, `Dari ${statusMeta[item.status]?.label || item.status} → ${statusMeta[target]?.label || target}`);
    setBusyId(item.id);
    try { await onUpdate(item.id, payload); logActivity(user, { action: "status_change", entity_type: "Shipment", entity_id: item.id, entity_name: item.outlet_name, details: `Status: ${statusMeta[item.status]?.label || item.status} → ${statusMeta[target]?.label || target}`, module: "pengiriman" }); }
    finally { setBusyId(null); }
  };

  const transitionTo = (item, target) => {
    if (target === item.status) return;
    const isAdmin = canReset;
    if (!isAdmin) {
      if (STEPS.indexOf(target) - STEPS.indexOf(item.status) !== 1) return;
      if (isLocked(item)) return;
    }
    const popup = TARGET_TO_POPUP[target];
    if (!popup || isSuper) { doChangeStatus(item, target); return; }
    setConfirmProcess({ item, target, popup });
  };

  const submitProcessConfirm = async (values) => {
    if (!confirmProcess) return;
    const { item, target } = confirmProcess;
    setConfirmProcess(null);
    await doChangeStatus(item, target, values);
  };

  const submitReschedule = async (values) => {
    const item = rescheduleItem;
    if (!item || !values.delivery_date) return;
    const oldDate = item.delivery_date;
    const payload = { ...RESET_FIELDS, delivery_date: values.delivery_date, status: "menunggu_antrian", rescheduled_from_date: oldDate, reschedule_reason: values.reschedule_reason || "", reschedule_note: `Pindahan dari jadwal tanggal ${oldDate}`, status_history: appendHistory(item, "menunggu_antrian", `Reschedule dari tanggal ${oldDate}`) };
    setRescheduleItem(null);
    setBusyId(item.id);
    try { await onUpdate(item.id, payload); logActivity(user, { action: "reschedule", entity_type: "Shipment", entity_id: item.id, entity_name: item.outlet_name, details: `Reschedule dari ${oldDate} ke ${values.delivery_date}`, module: "pengiriman" }); }
    finally { setBusyId(null); }
  };

  const submitAccuracy = async ({ accuracy, complaint_reason, complaint_type, complaint_category }) => {
    if (!accuracyItem) return;
    const payload = { accuracy, complaint_reason, complaint_type, complaint_category, status_history: appendHistory(accuracyItem, accuracyItem.status, `Akurasi diatur: ${accuracy}`) };
    setBusyId(accuracyItem.id);
    try { await onUpdate(accuracyItem.id, payload); logActivity(user, { action: "set_accuracy", entity_type: "Shipment", entity_id: accuracyItem.id, entity_name: accuracyItem.outlet_name, details: `Akurasi: ${accuracy}`, module: "pengiriman" }); }
    finally { setBusyId(null); }
  };

  const submitActualArrival = async (item, vals) => {
    const payload = { ...vals, status_history: appendHistory(item, item.status, `Aktual tiba diisi: ${vals.actual_arrival_date || "-"}`) };
    setBusyId(item.id);
    try { await onUpdate(item.id, payload); logActivity(user, { action: "set_actual_arrival", entity_type: "Shipment", entity_id: item.id, entity_name: item.outlet_name, details: `Aktual tiba: ${vals.actual_arrival_date || "-"}`, module: "pengiriman" }); }
    finally { setBusyId(null); }
  };

  const toggle = (id) => setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const deletable = isSuper ? shipments : shipments.filter((s) => !isLocked(s));
  const allSelected = deletable.length > 0 && selected.size === deletable.length;
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(deletable.map((s) => s.id)));
  const requestDelete = (item) => setConfirmId(item.id);
  const executeDeleteOne = async (e) => {
    if (e) e.preventDefault();
    const id = confirmId;
    if (!id) return;
    setBusyId(id);
    try {
      await onDelete(id);
      logActivity(user, { action: "delete", entity_type: "Shipment", entity_id: id, details: "Hapus pengiriman", module: "pengiriman" });
      setConfirmId(null);
      setSelected((prev) => { const n = new Set(prev); n.delete(id); return n; });
    } catch (err) {
      console.error("Delete failed:", err);
    } finally { setBusyId(null); }
  };
  const requestDeleteSelected = () => setConfirmBulk(true);
  const executeDeleteSelected = async (e) => {
    if (e) e.preventDefault();
    const ids = [...selected];
    if (!ids.length) { setConfirmBulk(false); return; }
    setDeleting(true);
    try {
      await onDeleteMany(ids);
      logActivity(user, { action: "bulk_delete", entity_type: "Shipment", entity_id: ids.join(","), entity_name: `${ids.length} pengiriman`, details: `Hapus ${ids.length} pengiriman terpilih`, module: "pengiriman" });
      setConfirmBulk(false);
      setSelected(new Set());
    } catch (err) {
      console.error("Bulk delete failed:", err);
    } finally { setDeleting(false); }
  };

  if (loading) return <div className="flex justify-center py-16"><div className="h-7 w-7 animate-spin rounded-full border-4 border-indigo-100 border-t-indigo-600" /></div>;
  if (!shipments.length) return <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center"><Truck className="mx-auto mb-3 h-8 w-8 text-slate-300" /><p className="font-medium">Belum ada data pengiriman</p></div>;

  const confirmCfg = confirmProcess ? POPUPS[confirmProcess.popup] : null;
  const confirmFields = confirmCfg ? confirmCfg.fields.map((f) => {
    if (f.type === "koli_verify") return { ...f, sourceValue: confirmProcess.item.packing_total_koli ?? 0 };
    if (f.type === "tonnage_verify") return { ...f, sourceValue: confirmProcess.item.tonnage ?? 0 };
    if (f.type === "readonly") return { ...f, sourceValue: confirmProcess.item[f.key] ?? 0 };
    if (f.key === "tonnage") return { ...f, defaultValue: confirmProcess.item.tonnage ?? "" };
    return f;
  }) : [];

  return <div className="space-y-3">
    {canDelete && <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <label className="flex items-center gap-2 text-sm font-medium text-slate-600">
        <Checkbox checked={allSelected} onCheckedChange={toggleAll} disabled={!deletable.length} />
        Pilih Semua
      </label>
      {selected.size > 0 && <button onClick={requestDeleteSelected} disabled={deleting} className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-700 disabled:opacity-50">
        <Trash2 className="h-3.5 w-3.5" />Hapus Terpilih ({selected.size})
      </button>}
    </div>}
    {shipments.map((item) => {
      const meta = statusMeta[item.status] || statusMeta.menunggu_antrian;
      const isBusy = busyId === item.id;
      const locked = isLocked(item);
      const isAdmin = canReset;
      const itemStatusIdx = STEPS.indexOf(item.status);
      const estimatedArrival = item.status === "sudah_dikirim" ? computeEstimatedArrival(item, etaMap) : null;
      const etaDays = getEtaDays(etaMap, item.outlet_name);
      const estimatedArrivalFromPlan = item.delivery_date ? (() => { const d = new Date(`${item.delivery_date}T00:00:00`); d.setDate(d.getDate() + etaDays); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; })() : null;
      const isStatusEnabled = (s) => isAdmin ? s !== item.status : (STEPS.indexOf(s) === itemStatusIdx + 1 && !locked);
      const anyStatusEnabled = isAdmin ? STEPS.some((s) => s !== item.status) : (itemStatusIdx >= 0 && itemStatusIdx < STEPS.length - 1 && !locked);
      const rows = [];
      if (item.status === "menunggu_antrian") rows.push({ label: "Antrian", start: menungguStartTime(item.delivery_date), end: null, Icon: Clock3, color: "text-amber-500", timerOnly: true, mode: "minutes" });
      if (item.timestamp_proses_picking) rows.push({ label: "Picking", start: item.timestamp_proses_picking, end: item.timestamp_proses_picking_end, Icon: Package, color: "text-blue-500" });
      if (item.timestamp_proses_packing) rows.push({ label: "Packing", start: item.timestamp_proses_packing, end: item.timestamp_proses_packing_end, Icon: ClipboardList, color: "text-violet-500" });
      if (item.timestamp_proses_loading) rows.push({ label: "Loading", start: item.timestamp_proses_loading, end: item.timestamp_proses_loading_end, Icon: Truck, color: "text-cyan-500" });
      if (item.timestamp_sudah_dikirim) rows.push({ label: "Dikirim", start: item.timestamp_sudah_dikirim, end: null, Icon: CircleCheck, color: "text-emerald-500", plain: true });
      if (item.status !== "sudah_dikirim" && estimatedArrivalFromPlan) rows.push({ label: "Estimasi Tiba", plainText: estimatedArrivalFromPlan, Icon: CalendarCheck, color: "text-indigo-500", plain: true, onClick: canEditEta ? () => setEtaEditOutlet(item.outlet_name) : null });
      if (estimatedArrival) rows.push({ label: "Estimasi Tiba", plainText: estimatedArrival, Icon: CalendarCheck, color: "text-emerald-500", plain: true });
      return <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            {canDelete && <Checkbox checked={selected.has(item.id)} onCheckedChange={() => toggle(item.id)} disabled={locked && !isSuper} className="mt-1" />}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => openDo(item)} className="truncate text-left font-semibold transition hover:text-indigo-600" title="Lihat detail DO">{item.outlet_name}</button>
                {locked && <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-500"><Lock className="h-3 w-3" />Terkunci</span>}
                <span className="text-xs text-slate-400">·</span>
                <span className="text-sm text-slate-500">{formatTonnage(item.tonnage)}</span>
              </div>
              <p className="mt-0.5 text-xs text-slate-400">DO: {item.do_number || "-"} · Armada: {item.fleet} · {item.warehouse}</p>
              {item.reschedule_note && <p className="mt-0.5 text-xs text-amber-600">↻ {item.reschedule_note}{item.reschedule_reason ? ` — ${item.reschedule_reason}` : ""}</p>}
              <div className="mt-2 flex flex-col gap-1 text-xs text-slate-500">
                {rows.map((r) => (
                  <span key={r.label} className="inline-flex items-center gap-1.5">
                    <r.Icon className={`h-3.5 w-3.5 ${r.color}`} />
                    <span>{r.label}:</span>
                    {r.plain ? (r.onClick ? <button onClick={r.onClick} className="rounded-lg px-1.5 py-0.5 text-left font-medium transition hover:bg-indigo-50 hover:text-indigo-700">{r.plainText || formatTimestamp(r.start)}</button> : <span>{r.plainText || formatTimestamp(r.start)}</span>)
                      : r.timerOnly ? <ProcessTimer start={r.start} end={r.end} mode={r.mode} />
                      : r.start ? <span className="inline-flex items-center gap-1.5"><span>{formatTimestamp(r.start)}</span><ProcessTimer start={r.start} end={r.end} /></span>
                      : <span className="text-slate-400">-</span>}
                  </span>
                ))}
              </div>
              {item.status === "sudah_dikirim" && (
                <div className="mt-2">
                  <button onClick={() => setActualArrivalItem(item)} disabled={isBusy || !canModifyItem(item)} className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50">
                    <CalendarCheck className="h-3.5 w-3.5" />{item.actual_arrival_date ? `Tiba: ${item.actual_arrival_date}` : "Isi Aktual Tiba"}
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${meta.className}`}>{meta.label}</span>
            {canEditStatus && SELESAI_TARGET[item.status] && <button onClick={() => transitionTo(item, SELESAI_TARGET[item.status])} disabled={isBusy || !canModifyItem(item)} className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-3 py-2 text-xs font-semibold text-white transition hover:bg-amber-600 disabled:opacity-50"><CircleCheck className="h-3.5 w-3.5" />{SELESAI_LABEL[item.status]}</button>}
            {item.status === "sudah_dikirim" && (
              canReset ? (
                <button onClick={() => setAccuracyId(item.id)} disabled={isBusy || !canModifyItem(item)} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50">
                  {item.accuracy ? accuracyMeta[item.accuracy]?.label : "Data Belum Tersedia"}<ChevronDown className="h-3.5 w-3.5" />
                </button>
              ) : (
                <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${item.accuracy ? accuracyMeta[item.accuracy]?.className : "bg-slate-50 text-slate-500 border-slate-200"}`}>{item.accuracy ? accuracyMeta[item.accuracy]?.label : "Data Belum Tersedia"}</span>
              )
            )}
            {canEditStatus && <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button disabled={isBusy || !anyStatusEnabled || !canModifyItem(item)} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">Ubah Status<ChevronDown className="h-3.5 w-3.5" /></button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {MANUAL_STEPS.map((s) => <DropdownMenuItem key={s} onClick={() => transitionTo(item, s)} disabled={!isStatusEnabled(s)}>{statusMeta[s]?.label || s}</DropdownMenuItem>)}
              </DropdownMenuContent>
            </DropdownMenu>}

            {canEditStatus && item.status !== "sudah_dikirim" && <button onClick={() => setRescheduleItem(item)} disabled={isBusy || !canModifyItem(item)} className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 transition hover:bg-amber-100 disabled:opacity-50"><CalendarClock className="h-3.5 w-3.5" />Rescheduled</button>}
            {canDelete && <button onClick={() => requestDelete(item)} disabled={isBusy || (locked && !isSuper)} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" /></button>}
            {item.status === "sudah_dikirim" && item.proof_file_url && <a href={item.proof_file_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"><FileText className="h-3.5 w-3.5" />Bukti</a>}
          </div>
        </div>
      </div>;
    })}
    <AccuracyDialog open={!!accuracyId} onClose={() => setAccuracyId(null)} onSubmit={submitAccuracy} outletName={accuracyItem?.outlet_name} accuracy={accuracyItem?.accuracy} complaintReason={accuracyItem?.complaint_reason} complaintType={accuracyItem?.complaint_type} complaintCategory={accuracyItem?.complaint_category} />
    <ProcessConfirmDialog open={!!confirmProcess} onClose={() => setConfirmProcess(null)} onSubmit={submitProcessConfirm} title={confirmCfg?.title} description={confirmCfg?.description} outletName={confirmProcess?.item?.outlet_name} fields={confirmFields} />
    <ProcessConfirmDialog open={!!rescheduleItem} onClose={() => setRescheduleItem(null)} onSubmit={submitReschedule} title={POPUPS.reschedule.title} description={POPUPS.reschedule.description} outletName={rescheduleItem?.outlet_name} fields={POPUPS.reschedule.fields} />
    <DoDetailDialog item={doItem} onClose={closeDo} />
    <ActualArrivalDialog open={!!actualArrivalItem} item={actualArrivalItem} onClose={() => setActualArrivalItem(null)} onCommit={(vals) => actualArrivalItem && submitActualArrival(actualArrivalItem, vals)} />
    <EditEtaDialog open={!!etaEditOutlet} outletName={etaEditOutlet || ""} onClose={() => setEtaEditOutlet(null)} />

    <AlertDialog open={!!confirmId} onOpenChange={(o) => !o && setConfirmId(null)}>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>Hapus pengiriman ini?</AlertDialogTitle><AlertDialogDescription>Apakah Anda yakin untuk menghapus data ini? Tindakan ini tidak dapat dibatalkan.</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel>Batal</AlertDialogCancel><AlertDialogAction onClick={executeDeleteOne} disabled={busyId === confirmId} className="bg-red-600 text-white hover:bg-red-700">{busyId === confirmId ? "Menghapus..." : "Hapus"}</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    <AlertDialog open={confirmBulk} onOpenChange={setConfirmBulk}>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>Hapus {selected.size} pengiriman?</AlertDialogTitle><AlertDialogDescription>Apakah Anda yakin untuk menghapus {selected.size} data pengiriman terpilih? Tindakan ini tidak dapat dibatalkan.</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel>Batal</AlertDialogCancel><AlertDialogAction onClick={executeDeleteSelected} disabled={deleting} className="bg-red-600 text-white hover:bg-red-700">{deleting ? "Menghapus..." : "Hapus"}</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>;
}
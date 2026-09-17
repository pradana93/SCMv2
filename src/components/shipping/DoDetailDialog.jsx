import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Download, Package, FileText, Loader2, Save, Printer, GripVertical, Upload, Trash2, Calculator, LayoutGrid } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";

import { formatTonnage, formatTimestamp, statusMeta } from "./shippingUtils";
import { formatDeliveryDateLong, buildMasterMap, convertItem } from "./packingUtils";
import { parsePackingListFile } from "./parsePackingList";
import { canEditMaster } from "./shippingUtils";
import { ensureOutlet } from "./ensureOutlet";
import { buildDocHtml, buildKoliPrintHtml } from "./buildDocHtml";
import BarcodeLabel from "@/components/shipping/BarcodeLabel";
import { usePermissions } from "./usePermissions";
import { useStockCurrent } from "@/components/shipping/useStockCurrent";

const LAYOUTS = [
  { value: "portrait", label: "A4 Potret" },
  { value: "landscape", label: "A4 Lanskap" },
  { value: "compact", label: "A4 Ringkas" },
];

const PACKING_COLUMNS = [
  { key: "no_koli", label: "No. Koli" },
  { key: "description", label: "Description" },
  { key: "qty", label: "Qty", align: "text-right" },
  { key: "satuan_gramasi", label: "Satuan Gramasi" },
  { key: "total_gramasi", label: "Total Gramasi (Gr)", align: "text-right", num: true },
  { key: "item_unit", label: "Item Unit" },
  { key: "notes", label: "Notes" },
];
const ALL_PACKING_COLS = PACKING_COLUMNS.map((c) => c.key);

export default function DoDetailDialog({ item, onClose }) {
  const [mode, setMode] = useState("do");
  const [printing, setPrinting] = useState(false);
  const [layout, setLayout] = useState("portrait");
  const printRef = useRef(null);
  const { data: master = [], isLoading: masterLoading } = useQuery({ queryKey: ["masterPackingItems"], queryFn: () => base44.entities.MasterPackingItem.list() });
  const qc = useQueryClient();
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [saving, setSaving] = useState(false);
  const [tonnage, setTonnage] = useState("");
  const [warehouse, setWarehouse] = useState("");
  const [outletName, setOutletName] = useState("");
  const [packingFile, setPackingFile] = useState(null);
  const [packingParsed, setPackingParsed] = useState([]);
  const [savedPacking, setSavedPacking] = useState([]);
  const [editingSheets, setEditingSheets] = useState([]);
  const [uploadError, setUploadError] = useState("");
  const [packingUrl, setPackingUrl] = useState("");
  const [fleet, setFleet] = useState("");
  const { canEdit: canEditPerm } = usePermissions();
  const { data: fleets = [] } = useQuery({ queryKey: ["fleets"], queryFn: () => base44.entities.Fleet.list() });
  const { data: warehouses = [] } = useQuery({ queryKey: ["warehouses"], queryFn: () => base44.entities.Warehouse.list() });
  const { data: outlets = [] } = useQuery({ queryKey: ["outlets"], queryFn: () => base44.entities.Outlet.list() });
  const warehouseOptions = warehouses.map((w) => w.name).slice().sort((a, b) => a.localeCompare(b, "id"));
  const outletOptions = outlets.map((o) => o.name).slice().sort((a, b) => a.localeCompare(b, "id"));
  const fleetOptions = fleets.map((f) => f.name).slice().sort((a, b) => a.localeCompare(b, "id"));
  const { calcTonnage } = useStockCurrent();

  useEffect(() => {
    if (item) {
      const its = Array.isArray(item.do_items) ? item.do_items : [];
      setRows(its.map((it) => ({ code: it.code ?? "", name: it.name ?? "", quantity: it.quantity ?? 0, unit: it.unit ?? "", koli: it.koli ?? "", notes: it.notes ?? "" })));
      setTonnage(item.tonnage ?? "");
      setWarehouse(item.warehouse ?? "");
      setOutletName(item.outlet_name ?? "");
      setFleet(item.fleet ?? "");
      setPackingUrl(item.proof_packing_url ?? "");
      setPackingFile(null);
      setPackingParsed([]);
      setSavedPacking(Array.isArray(item.packing_list_data) ? item.packing_list_data : []);
      setEditingSheets((Array.isArray(item.packing_list_data) ? item.packing_list_data : []).map((s) => ({ ...s, items: (s.items || []).map((it) => ({ ...it })) })));
      setUploadError("");
      setMode("do");
    }
  }, [item?.id]);

  if (!item) return null;
  const isPacking = mode === "packing";
  const isItemTransfer = item.document_type === "item_transfer";
  const items = Array.isArray(item.do_items) ? item.do_items : [];
  const packingListSheets = packingParsed.length ? packingParsed : savedPacking;
  const hasPackingList = packingListSheets.length > 0;
  const title = isPacking ? "PACKING LIST" : (isItemTransfer ? "Item Transfer Detail" : "Delivery Order Detail");
  const masterMap = buildMasterMap(master);
  const canManagePacking = canEditMaster(user);
  const canEdit = canManagePacking;
  const canEditPacking = canEditPerm("pengiriman.edit_packing");
  const canEditFleet = canEditPerm("pengiriman.edit_fleet");

  const onDragEnd = (res) => {
    if (!res.destination || res.destination.index === res.source.index) return;
    setRows((prev) => {
      const n = [...prev];
      const [moved] = n.splice(res.source.index, 1);
      n.splice(res.destination.index, 0, moved);
      return n;
    });
  };
  const setField = (i, field, value) => setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
  const updateSheetField = (si, field, value) => setEditingSheets((prev) => prev.map((s, idx) => (idx === si ? { ...s, [field]: value } : s)));
  const updateSheetItem = (si, ii, field, value) => setEditingSheets((prev) => prev.map((s, idx) => (idx === si ? { ...s, items: (s.items || []).map((it, j) => (j === ii ? { ...it, [field]: value } : it)) } : s)));
  const onDragEndSheet = (si, res) => {
    if (!res.destination || res.destination.index === res.source.index) return;
    setEditingSheets((prev) => prev.map((s, idx) => {
      if (idx !== si) return s;
      const items = [...(s.items || [])];
      const [moved] = items.splice(res.source.index, 1);
      items.splice(res.destination.index, 0, moved);
      return { ...s, items };
    }));
  };
  const saveEditedPacking = async () => {
    setSaving(true);
    try {
      const update = { packing_list_data: editingSheets };
      if (packingFile) {
        try { const res = await base44.integrations.Core.UploadFile({ file: packingFile }); update.proof_packing_url = res.file_url; } catch {}
      }
      await base44.entities.Shipment.update(item.id, update);
      qc.invalidateQueries({ queryKey: ["shipments"] });
      setSavedPacking(editingSheets);
      setPackingParsed([]);
      setPackingFile(null);
    } finally { setSaving(false); }
  };

  const savePacking = async () => {
    setSaving(true);
    try {
      const payload = rows.map((r) => ({ code: r.code || null, name: r.name || null, quantity: Number(r.quantity) || 0, unit: r.unit || null, koli: r.koli || null, notes: r.notes || null }));
      const oldItems = Array.isArray(item.do_items) ? item.do_items : [];
      const oldByName = new Map();
      for (const o of oldItems) { if (o && o.name) oldByName.set(o.name, o); }
      const log = Array.isArray(item.packing_log) ? [...item.packing_log] : [];
      const who = user?.display_name || user?.full_name || user?.email || "Unknown";
      const when = new Date().toISOString();
      rows.forEach((r, i) => {
        const old = r.name ? oldByName.get(r.name) : undefined;
        const rowName = r.name || `Baris ${i + 1}`;
        if (String(r.koli ?? "") !== String(old?.koli ?? "")) log.push({ row_name: rowName, field: "No. Koli", old_value: String(old?.koli ?? ""), new_value: String(r.koli ?? ""), changed_by: who, changed_at: when });
        if (String(r.notes ?? "") !== String(old?.notes ?? "")) log.push({ row_name: rowName, field: "Notes", old_value: String(old?.notes ?? ""), new_value: String(r.notes ?? ""), changed_by: who, changed_at: when });
      });
      await base44.entities.Shipment.update(item.id, { do_items: payload, packing_log: log });
      qc.invalidateQueries({ queryKey: ["shipments"] });
    } finally { setSaving(false); }
  };

  const saveTonnage = async () => {
    setSaving(true);
    try {
      await base44.entities.Shipment.update(item.id, { tonnage: Number(tonnage) || 0 });
      qc.invalidateQueries({ queryKey: ["shipments"] });
    } finally { setSaving(false); }
  };

  const saveWarehouse = async () => {
    setSaving(true);
    try {
      await base44.entities.Shipment.update(item.id, { warehouse: warehouse.trim() || item.warehouse });
      qc.invalidateQueries({ queryKey: ["shipments"] });
    } finally { setSaving(false); }
  };

  const saveCustomer = async () => {
    setSaving(true);
    try {
      await base44.entities.Shipment.update(item.id, { outlet_name: outletName.trim() || item.outlet_name });
      ensureOutlet(outletName.trim() || item.outlet_name);
      qc.invalidateQueries({ queryKey: ["shipments"] });
    } finally { setSaving(false); }
  };

  const saveFleet = async () => {
    setSaving(true);
    try {
      await base44.entities.Shipment.update(item.id, { fleet: fleet.trim() });
      qc.invalidateQueries({ queryKey: ["shipments"] });
    } finally { setSaving(false); }
  };

  const handlePackingFile = async (file) => {
    if (!file) return;
    setUploadError("");
    try {
      const sheets = await parsePackingListFile(file);
      if (!sheets.length || !sheets.some((s) => s.items.length)) { setUploadError("File tidak berisi data packing list yang valid."); return; }
      setPackingParsed(sheets);
      setEditingSheets(sheets.map((s) => ({ ...s, items: (s.items || []).map((it) => ({ ...it })) })));
      setPackingFile(file);
    } catch { setUploadError("Gagal membaca file. Pastikan format .xlsx sesuai contoh."); }
  };

  const savePackingList = async () => {
    if (!packingFile || !packingParsed.length) return;
    setSaving(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file: packingFile });
      await base44.entities.Shipment.update(item.id, { proof_packing_url: file_url, packing_list_data: packingParsed });
      qc.invalidateQueries({ queryKey: ["shipments"] });
      setSavedPacking(packingParsed);
      setPackingParsed([]);
      setPackingFile(null);
    } finally { setSaving(false); }
  };

  const deletePackingList = async () => {
    if (!window.confirm("Hapus packing list yang tersimpan? Tindakan ini tidak dapat dibatalkan.")) return;
    setSaving(true);
    try {
      await base44.entities.Shipment.update(item.id, { proof_packing_url: "", packing_list_data: [] });
      qc.invalidateQueries({ queryKey: ["shipments"] });
      setSavedPacking([]);
      setPackingParsed([]);
      setPackingFile(null);
    } finally { setSaving(false); }
  };

  const buildDocForPrint = () => {
    const editableRows = rows.map((r) => { const { qty, unit } = convertItem(r, masterMap); return { koli: r.koli || "", name: r.name || "-", qty, unit, notes: r.notes || "" }; });
    return buildDocHtml({ title, isPacking, item, sheets: packingListSheets, editableRows, orientation: layout === "landscape" ? "landscape" : "portrait" });
  };

  const openPrintWindow = (html) => {
    // Inject auto-print script + manual print button (fallback for mobile).
    // Blob URL approach: browser does a normal page load (more reliable than document.write on mobile).
    // The manual print button ensures the user can always trigger print even if auto-print is blocked.
    const printBar = `
      <div id="print-bar" style="position:fixed;top:0;left:0;right:0;z-index:9999;background:#1e293b;color:#fff;padding:10px;text-align:center;font-family:Arial,sans-serif;font-size:14px;">
        <button onclick="window.print()" style="background:#4f46e5;color:#fff;border:none;padding:10px 28px;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer;">🖨️ Cetak Sekarang</button>
      </div>
      <style>@media print{#print-bar{display:none!important;}}</style>
      <script>window.onload=function(){setTimeout(function(){try{window.focus();window.print();}catch(e){}},600);};<\/script>`;
    const fullHtml = html.includes("</body>") ? html.replace("</body>", printBar + "</body>") : html + printBar;

    const blob = new Blob([fullHtml], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const w = window.open(url, "_blank");
    if (!w) {
      URL.revokeObjectURL(url);
      alert("Popup diblokir browser. Mohon izinkan popup untuk mencetak, lalu coba lagi.");
      return;
    }
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  };

  const printDoc = () => {
    const html = buildDocForPrint();
    openPrintWindow(html);
  };

  const downloadPdf = () => {
    // Use browser print-to-PDF dialog (highest quality, no canvas rendering)
    const html = buildDocForPrint();
    openPrintWindow(html);
  };

  const printPerKoli = () => {
    const html = buildKoliPrintHtml(item, packingListSheets);
    openPrintWindow(html);
  };

  const selectClass = "rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none transition focus:border-indigo-500";

  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-indigo-600" />{isPacking ? "Packing List" : (isItemTransfer ? "Item Transfer" : "Delivery Order")}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">Tata Letak
            <select value={layout} onChange={(e) => setLayout(e.target.value)} className={selectClass}>
              {LAYOUTS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
          </label>
          {!isPacking && canEdit && <button onClick={saveTonnage} disabled={saving || tonnage === ""} className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-60"><Save className="h-3.5 w-3.5" />{saving ? "Menyimpan..." : "Simpan Tonase"}</button>}
          {hasPackingList && <button onClick={() => setMode((m) => (m === "do" ? "packing" : "do"))} className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100"><Package className="h-3.5 w-3.5" />{isPacking ? "Lihat DO" : "Lihat Packing List"}</button>}
          {isPacking && canEditPacking && hasPackingList && <button onClick={saveEditedPacking} disabled={saving} className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-60"><Save className="h-3.5 w-3.5" />{saving ? "Menyimpan..." : "Simpan Packing List"}</button>}
          {isPacking && hasPackingList && <button onClick={printPerKoli} className="inline-flex items-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-700 transition hover:bg-violet-100"><LayoutGrid className="h-3.5 w-3.5" />Print Per Koli</button>}
          <button onClick={printDoc} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"><Printer className="h-3.5 w-3.5" />Cetak</button>
          <button onClick={downloadPdf} className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"><Download className="h-3.5 w-3.5" />Download PDF</button>
        </div>
        {!isPacking && canManagePacking && (
          <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3">
            <p className="text-xs font-semibold text-indigo-700">{hasPackingList ? "Packing List tersimpan. Upload ulang file .xlsx untuk mengganti." : "Upload Packing List (.xlsx sesuai format contoh)"}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"><Upload className="h-3.5 w-3.5" />{hasPackingList ? "Upload Ulang" : "Pilih File"}<input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={(e) => handlePackingFile(e.target.files?.[0] || null)} /></label>
              <span className="text-xs text-slate-500">{packingFile ? packingFile.name : (hasPackingList ? "File tersimpan" : "Belum ada file")}</span>
              {packingFile && packingParsed.length > 0 && <button onClick={savePackingList} disabled={saving} className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-60"><Save className="h-3.5 w-3.5" />{saving ? "Menyimpan..." : "Simpan Packing List"}</button>}
              {hasPackingList && canManagePacking && <button onClick={deletePackingList} disabled={saving} className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-60"><Trash2 className="h-3.5 w-3.5" />{saving ? "Menghapus..." : "Hapus Packing List"}</button>}
              {uploadError && <span className="text-xs text-red-600">{uploadError}</span>}
            </div>
          </div>
        )}
        {isPacking && masterLoading && <p className="flex items-center gap-1.5 text-xs text-slate-400"><Loader2 className="h-3.5 w-3.5 animate-spin" />Memuat master packing...</p>}
        <div ref={printRef} className="print-area rounded-xl border border-slate-300 bg-white p-6 text-[13px] text-slate-800">
          <div className="text-center"><p className="text-base font-bold">PT Bangor Berkembang Bersama</p><p className="text-sm font-semibold tracking-wide text-slate-600">{title}</p></div>
          {isPacking ? (
            hasPackingList ? (
              <>
                {editingSheets.map((sheet, si) => (
                  <div key={si} className={si > 0 ? "mt-8" : ""}>
                    <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2">
                      <div><span className="font-semibold">Ship To</span> : {sheet.ship_to || "-"}</div>
                      <div><span className="font-semibold">Delivery No</span> : {sheet.delivery_no || "-"}</div>
                      {canEditPacking ? (
                        <>
                          <div className="flex items-center gap-1.5"><span className="font-semibold shrink-0">Ship Via</span> : <input value={sheet.ship_via || ""} onChange={(e) => updateSheetField(si, "ship_via", e.target.value)} className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" /></div>
                          <div className="flex items-center gap-1.5"><span className="font-semibold shrink-0">Delivery Date</span> : <input type="date" value={sheet.delivery_date || ""} onChange={(e) => updateSheetField(si, "delivery_date", e.target.value)} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" /></div>
                        </>
                      ) : (
                        <>
                          <div><span className="font-semibold">Ship Via</span> : {sheet.ship_via || "-"}</div>
                          <div><span className="font-semibold">Delivery Date</span> : {sheet.delivery_date || "-"}</div>
                        </>
                      )}
                    </div>
                    <DragDropContext onDragEnd={(res) => onDragEndSheet(si, res)}>
                      <table className="mt-4 w-full border-collapse text-left">
                        <thead><tr className="border-b border-slate-400 text-xs">
                          {canEditPacking && <th className="py-2 pr-1 w-6"></th>}
                          {(sheet.columns || ALL_PACKING_COLS).map((k) => {
                            const c = PACKING_COLUMNS.find((c) => c.key === k);
                            return c ? <th key={k} className={`py-2 pr-2 ${c.align || ""}`}>{c.label}</th> : null;
                          })}
                        </tr></thead>
                        <Droppable droppableId={`packing-sheet-${si}`}>
                          {(provided) => (
                            <tbody ref={provided.innerRef} {...provided.droppableProps}>
                              {(sheet.items || []).map((it, i) => (
                                <Draggable draggableId={`sheet-${si}-row-${i}`} index={i} key={`sheet-${si}-row-${i}`}>
                                  {(prov) => (
                                    <tr ref={prov.innerRef} {...prov.draggableProps} className="border-b border-slate-100 align-top">
                                      {canEditPacking && <td className="py-1.5 pr-1 w-6 text-center" {...prov.dragHandleProps}>{!printing && <GripVertical className="h-4 w-4 cursor-grab text-slate-300" />}</td>}
                                      {(sheet.columns || ALL_PACKING_COLS).map((k) => {
                                        const c = PACKING_COLUMNS.find((c) => c.key === k);
                                        if (!c) return null;
                                        const v = it[k];
                                        if (canEditPacking && k === "no_koli") {
                                          return <td key={k} className="py-1.5 pr-2"><input inputMode="numeric" value={v || ""} onChange={(e) => updateSheetItem(si, i, "no_koli", e.target.value.replace(/[^0-9]/g, ""))} className="w-12 border-b border-slate-200 bg-transparent text-center outline-none focus:border-indigo-500 focus:bg-amber-50" /></td>;
                                        }
                                        if (canEditPacking && k === "notes") {
                                          return <td key={k} className="py-1.5 pr-2"><input value={v || ""} onChange={(e) => updateSheetItem(si, i, "notes", e.target.value)} className="w-full border-b border-slate-200 bg-transparent outline-none focus:border-indigo-500 focus:bg-amber-50" /></td>;
                                        }
                                        return <td key={k} className={`py-1.5 pr-2 ${c.align || ""}`}>{c.num ? Number(v || 0).toLocaleString("id-ID") : (v || "-")}</td>;
                                      })}
                                    </tr>
                                  )}
                                </Draggable>
                              ))}
                              {provided.placeholder}
                            </tbody>
                          )}
                        </Droppable>
                      </table>
                    </DragDropContext>
                  </div>
                ))}
              </>
            ) : (
            <>
              <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2">
                <div><span className="font-semibold">Ship To</span> : {item.outlet_name || "-"}</div>
                <div><span className="font-semibold">Delivery No</span> : {item.do_number || "-"}</div>
                <div><span className="font-semibold">Ship Via</span> : {item.fleet || "-"}</div>
                <div><span className="font-semibold">Delivery Date</span> : {formatDeliveryDateLong(item.delivery_date)}</div>
              </div>
              <DragDropContext onDragEnd={onDragEnd}>
                <table className="mt-4 w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-slate-400 text-xs">
                      <th className="py-2 pr-1 w-6"></th>
                      <th className="py-2 pr-2">No. Koli</th>
                      <th className="py-2 pr-2">Description</th>
                      <th className="py-2 pr-2 text-right">Qty</th>
                      <th className="py-2 pr-2">Item Unit</th>
                      <th className="py-2">Notes</th>
                    </tr>
                  </thead>
                  <Droppable droppableId="packing-rows">
                    {(provided) => (
                      <tbody ref={provided.innerRef} {...provided.droppableProps}>
                        {rows.length === 0 ? (
                          <tr><td colSpan={6} className="py-6 text-center text-slate-400">Detail item tidak tersedia.</td></tr>
                        ) : rows.map((r, i) => {
                          const { qty, unit } = convertItem(r, masterMap);
                          return (
                            <Draggable draggableId={`row-${i}`} index={i} key={`row-${i}`}>
                              {(prov) => (
                                <tr ref={prov.innerRef} {...prov.draggableProps} className="border-b border-slate-100 align-top">
                                  <td className="py-1.5 pr-1 w-6 text-center" {...prov.dragHandleProps}>
                                    {!printing && <GripVertical className="h-4 w-4 cursor-grab text-slate-300" />}
                                  </td>
                                  <td className="py-1.5 pr-2"><input type="text" inputMode="numeric" pattern="[0-9]*" value={r.koli} onChange={(e) => setField(i, "koli", e.target.value.replace(/[^0-9]/g, ""))} className="w-12 border-b border-slate-200 bg-transparent text-center outline-none focus:border-indigo-500 focus:bg-amber-50" /></td>
                                  <td className="py-1.5 pr-2">{r.name || "-"}</td>
                                  <td className="py-1.5 pr-2 text-right">{qty}</td>
                                  <td className="py-1.5 pr-2">{unit}</td>
                                  <td className="py-1.5 pr-2"><input value={r.notes} onChange={(e) => setField(i, "notes", e.target.value)} className="w-full border-b border-slate-200 bg-transparent outline-none focus:border-indigo-500 focus:bg-amber-50" /></td>
                                </tr>
                              )}
                            </Draggable>
                          );
                        })}
                        {provided.placeholder}
                      </tbody>
                    )}
                  </Droppable>
                </table>
              </DragDropContext>
            </>
            )
          ) : (
            <>
              {canEdit ? (
                <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 px-3 py-2">
                  <label className="text-xs font-semibold text-slate-600">Nama Gudang Asal</label>
                  <select value={warehouse} onChange={(e) => setWarehouse(e.target.value)} className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100">
                    <option value="" disabled>Pilih gudang</option>
                    {warehouseOptions.map((w) => <option key={w} value={w}>{w}</option>)}
                  </select>
                  <button onClick={saveWarehouse} disabled={saving || !warehouse.trim()} className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-60"><Save className="h-3.5 w-3.5" />{saving ? "Menyimpan..." : "Simpan Gudang"}</button>
                </div>
              ) : (
                <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2">
                  <div><span className="font-semibold">Gudang Asal</span> : {item.warehouse || "-"}</div>
                </div>
              )}
              <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2">
                <div><span className="font-semibold">Number</span> : {item.do_number || "-"}</div>
                <div><span className="font-semibold">Customer</span> : {canEdit ? <span className="flex items-center gap-1.5"><select value={outletName} onChange={(e) => setOutletName(e.target.value)} className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"><option value="" disabled>Pilih customer</option>{outletOptions.map((o) => <option key={o} value={o}>{o}</option>)}</select><button onClick={saveCustomer} disabled={saving || !outletName.trim()} className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-60"><Save className="h-3 w-3" />{saving ? "..." : "Simpan"}</button></span> : (item.outlet_name || "-")}</div>
                <div><span className="font-semibold">Date</span> : {item.delivery_date || "-"}</div>
                <div><span className="font-semibold">Tonase</span> : {canEdit ? <span className="flex items-center gap-1.5"><input type="number" min="0" inputMode="numeric" value={tonnage} onChange={(e) => setTonnage(e.target.value)} className="w-24 border-b border-slate-200 bg-transparent text-right outline-none focus:border-indigo-500 focus:bg-amber-50" /> kg<button type="button" onClick={() => setTonnage(calcTonnage(rows))} className="rounded-lg border border-indigo-200 bg-indigo-50 px-2 py-1 text-[11px] font-semibold text-indigo-700 transition hover:bg-indigo-100" title="Hitung dari gramasi master barang"><Calculator className="h-3 w-3" /></button></span> : formatTonnage(item.tonnage)}</div>
                <div><span className="font-semibold">Armada</span> : {canEditFleet ? <span className="flex items-center gap-1.5"><select value={fleet} onChange={(e) => setFleet(e.target.value)} className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"><option value="" disabled>Pilih armada</option>{fleetOptions.map((f) => <option key={f} value={f}>{f}</option>)}</select><button onClick={saveFleet} disabled={saving} className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-60"><Save className="h-3 w-3" />{saving ? "..." : "Simpan"}</button></span> : (item.fleet || "-")}</div>
              </div>
              <table className="mt-4 w-full border-collapse text-left">
                <thead><tr className="border-b border-slate-400 text-xs"><th className="py-2 pr-2">Code#</th><th className="py-2 pr-2">Item Name</th><th className="py-2 pr-2 text-right">Quantity</th><th className="py-2">Unit</th></tr></thead>
                <tbody>
                  {items.length === 0 ? <tr><td colSpan={4} className="py-6 text-center text-slate-400">Detail item tidak tersedia.</td></tr> : items.map((it, i) => (
                    <tr key={i} className="border-b border-slate-100 align-top"><td className="py-1.5 pr-2">{it.code || "-"}</td><td className="py-1.5 pr-2">{it.name || "-"}</td><td className="py-1.5 pr-2 text-right">{it.quantity}</td><td className="py-1.5">{it.unit || "-"}</td></tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
          {item.do_barcode && (
            <div className="mt-6 flex flex-col items-center rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="mb-2 text-xs font-semibold text-slate-500">Barcode DO</p>
              <BarcodeLabel value={item.do_barcode} height={50} fontSize={12} displayValue={true} />
            </div>
          )}
          <div className="mt-8 flex justify-between text-xs text-slate-600">
            <div className="w-40"><p>Checker</p><div className="mt-8 border-t border-slate-400 pt-1 text-center">({item.checker_name || ".........."})</div></div>
            <div className="w-40"><p>{isPacking ? "Packer" : "Driver / Crew"}</p><div className="mt-8 border-t border-slate-400 pt-1 text-center">(..........)</div></div>
          </div>
        </div>
        {isPacking && Array.isArray(item.packing_log) && item.packing_log.length > 0 && (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold text-slate-600">Riwayat Perubahan (No. Koli / Notes)</p>
            <div className="mt-2 max-h-40 space-y-1.5 overflow-y-auto text-xs">
              {[...item.packing_log].reverse().map((l, i) => (
                <div key={i} className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="font-medium text-slate-700">{l.row_name}</span><span className="text-slate-400">·</span>
                  <span className="text-indigo-600">{l.field}</span>
                  <span className="text-slate-500">{l.old_value || "(kosong)"} → {l.new_value || "(kosong)"}</span><span className="text-slate-400">·</span>
                  <span className="text-slate-600">{l.changed_by}</span><span className="text-slate-400">·</span>
                  <span className="text-slate-400">{formatTimestamp(l.changed_at)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {Array.isArray(item.status_history) && item.status_history.length > 0 && (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold text-slate-600">Riwayat Status</p>
            <div className="mt-2 max-h-40 space-y-1.5 overflow-y-auto text-xs">
              {[...item.status_history].reverse().map((h, i) => (
                <div key={i} className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="font-medium text-slate-700">{h.status ? (statusMeta[h.status]?.label || h.status) : "-"}</span>
                  {h.note && <><span className="text-slate-400">·</span><span className="text-slate-500">{h.note}</span></>}
                  <span className="text-slate-400">·</span>
                  <span className="text-slate-600">{h.by || "-"}</span>
                  <span className="text-slate-400">·</span>
                  <span className="text-slate-400">{formatTimestamp(h.timestamp)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, PackagePlus, Boxes, AlertTriangle, Pencil, Trash2, Search, ArrowLeftRight, History, ScanLine, Warehouse } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { usePermissions } from "@/components/shipping/usePermissions";
import { useUserWarehouses } from "@/components/shipping/useUserWarehouses";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import ConfirmDeleteDialog from "@/components/shipping/master/ConfirmDeleteDialog";
import * as XLSX from "xlsx";
import StockImportButton from "@/components/shipping/StockImportButton";
import WarehouseMultiSelect from "@/components/shipping/WarehouseMultiSelect";
import UnitEditor from "@/components/shipping/UnitEditor";
import StockMovementDialog from "@/components/shipping/StockMovementDialog";
import FormSelect from "@/components/shipping/FormSelect";
import StockHistory from "@/components/shipping/StockHistory";
import StockTransactionReviewDialog from "@/components/shipping/StockTransactionReviewDialog";
import StockItemReviewDialog from "@/components/shipping/StockItemReviewDialog";
import BarcodeScanner from "@/components/shipping/BarcodeScanner";
import BarcodeCenterPanel from "@/components/shipping/BarcodeCenterPanel";
import StockScanDialog from "@/components/shipping/StockScanDialog";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { ALL_WAREHOUSES, WAREHOUSES } from "@/components/shipping/shippingUtils";
import { convertToBase, getBaseUnit } from "@/components/shipping/unitConversion";

const today = () => new Date().toISOString().slice(0, 10);
const norm = (s) => (s || "").trim().toLowerCase();
const normKey = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const parseExcelDate = (value) => {
  if (value === null || value === undefined || value === "") return "";
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  if (typeof value === "number") {
    const date = new Date(Math.round((value - 25569) * 86400 * 1000));
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, "0");
    const d = String(date.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const s = String(value).trim();
  if (!s) return "";
  const m1 = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m1) return `${m1[1]}-${m1[2].padStart(2, "0")}-${m1[3].padStart(2, "0")}`;
  const m2 = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (m2) return `${m2[3]}-${m2[2].padStart(2, "0")}-${m2[1].padStart(2, "0")}`;
  return s;
};
const inputClass = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";

export default function Stock() {
  const { can, canEdit, canDelete } = usePermissions();
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: items = [], isLoading } = useQuery({ queryKey: ["stockItems"], queryFn: () => base44.entities.StockItem.list() });
  const { data: movements = [] } = useQuery({ queryKey: ["stockMovements"], queryFn: () => base44.entities.StockMovement.list("-created_date", 200) });
  const { data: shipments = [] } = useQuery({ queryKey: ["shipments", "stock"], queryFn: () => base44.entities.Shipment.list("-delivery_date", 500) });
  const { data: master = [] } = useQuery({ queryKey: ["masterPackingItems"], queryFn: () => base44.entities.MasterPackingItem.list() });
  const { data: warehouseList = [] } = useQuery({ queryKey: ["warehouses"], queryFn: () => base44.entities.Warehouse.list() });
  const { data: categoryList = [] } = useQuery({ queryKey: ["categories"], queryFn: () => base44.entities.Category.list() });
  const categoryNames = useMemo(() => categoryList.map((c) => c.name).slice().sort((a, b) => a.localeCompare(b, "id")), [categoryList]);

  const canItemAdd = can("master.item_add");
  const canItemEdit = canEdit("master.item_edit");
  const canItemDelete = canDelete("master.item_delete");
  const canIn = can("stock.in");
  const canViewTx = can("stock.transaction");
  const [itemDialog, setItemDialog] = useState(false);
  const historyId = searchParams.get("history");
  const historyItem = historyId ? items.find((i) => i.id === historyId) : null;
  const openHistory = (item) => { const next = new URLSearchParams(searchParams); next.set("history", item.id); setSearchParams(next); };
  const closeHistory = () => { const next = new URLSearchParams(searchParams); next.delete("history"); setSearchParams(next, { replace: true }); };
  const { userWarehouses, hasAll } = useUserWarehouses();
  const [wh, setWh] = useState(hasAll ? [] : userWarehouses);
  useEffect(() => { if (!hasAll && userWarehouses.length) setWh(userWarehouses); }, [hasAll, userWarehouses]);
  const [stockDate, setStockDate] = useState(today());
  const [whCtrl, setWhCtrl] = useState("");
  const destWarehouses = useMemo(() => warehouseList.map((w) => w.name).filter((w) => w !== whCtrl).slice().sort((a, b) => a.localeCompare(b, "id")), [warehouseList, whCtrl]);
  const [tab, setTab] = useState("items");
  const [ctrlOpen, setCtrlOpen] = useState(false);
  const [ctrlRows, setCtrlRows] = useState([]);
  const [ctrlType, setCtrlType] = useState("adjustment");
  const [ctrlDate, setCtrlDate] = useState(today());
  const [whCtrlTo, setWhCtrlTo] = useState("");
  const blankRow = () => ({ itemId: "", qty: "", unit: "", adjType: "tambah", note: "" });
  const [confirmId, setConfirmId] = useState(null);
  const [confirmBulk, setConfirmBulk] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [txPreview, setTxPreview] = useState(null);
  const [itemPreview, setItemPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [bulkWhOpen, setBulkWhOpen] = useState(false);
  const [bulkWhValue, setBulkWhValue] = useState([]);
  const [scanRowIdx, setScanRowIdx] = useState(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [search, setSearch] = useState("");

  const itemByBarcode = (barcode) => {
    return items.find((it) => it.barcode === barcode || it.code === barcode || (it.barcode && normKey(it.barcode) === normKey(barcode)) || (it.code && normKey(it.code) === normKey(barcode)));
  };
  const onScanCtrl = (barcode) => {
    const it = itemByBarcode(barcode);
    if (!it) { alert(`Barcode "${barcode}" tidak ditemukan di master barang.`); return; }
    setCtrlRows((p) => p.map((r, idx) => idx === scanRowIdx ? { ...r, itemId: it.id } : r));
    setScanRowIdx(null);
  };
  const [editing, setEditing] = useState(null);
  const [fName, setFName] = useState("");
  const [fCode, setFCode] = useState("");
  const [fUnits, setFUnits] = useState([]);
  const [fMin, setFMin] = useState("");
  const [fCat, setFCat] = useState("");
  const [fGramasi, setFGramasi] = useState("");
  const [fWarehouses, setFWarehouses] = useState([]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["stockItems"] });
    qc.invalidateQueries({ queryKey: ["stockMovements"] });
  };

  // React to scan-navigation params (?open=card&item=ID | ?open=tx&item=ID&type=masuk|keluar)
  const lastScanRef = useRef("");
  useEffect(() => {
    const open = searchParams.get("open");
    const itemId = searchParams.get("item");
    const type = searchParams.get("type");
    if (!open || !itemId) { lastScanRef.current = ""; return; }
    if (isLoading) return;
    const key = `${open}|${itemId}|${type}`;
    if (lastScanRef.current === key) return;
    lastScanRef.current = key;
    const it = items.find((i) => i.id === itemId);
    if (it) {
      setTab("items");
      if (open === "card") {
        const next = new URLSearchParams();
        next.set("history", it.id);
        setSearchParams(next);
      } else if (open === "tx") {
        const baseU = Array.isArray(it.units) && it.units.length ? (it.units.find((u) => u.is_base) || it.units[0]) : null;
        setCtrlType("adjustment");
        setCtrlDate(today());
        setWhCtrl("");
        setWhCtrlTo("");
        setCtrlRows([{ itemId: it.id, qty: "", unit: baseU?.name || it.unit || "", adjType: type === "keluar" ? "kurang" : "tambah", note: "" }]);
        setCtrlOpen(true);
        setSearchParams(new URLSearchParams(), { replace: true });
      }
    }
  }, [searchParams, items, isLoading, setSearchParams]);

  // Auto-sync daftar barang dari item pada pengiriman (menggabungkan master barang)
  useEffect(() => {
    if (isLoading) return;
    const existing = new Set(items.map((o) => normKey(o.name)));
    const masterMap = new Map();
    for (const m of master) if (m && m.name) masterMap.set(normKey(m.name), m);
    const missing = [];
    const seen = new Set();
    for (const s of shipments) {
      for (const it of (Array.isArray(s.do_items) ? s.do_items : [])) {
        const nm = String(it?.name || "").trim();
        if (!nm) continue;
        const k = normKey(nm);
        if (existing.has(k) || seen.has(k)) continue;
        seen.add(k);
        const m = masterMap.get(k);
        const unit = m?.satuan || String(it?.unit || "").trim() || "";
        missing.push({ name: nm, unit });
      }
    }
    if (!missing.length) return;
    let cancelled = false;
    base44.entities.StockItem.bulkCreate(missing).then(() => { if (!cancelled) refresh(); }).catch(() => {});
    return () => { cancelled = true; };
  }, [items, shipments, isLoading, master]);

  const itemByName = (name) => items.find((i) => norm(i.name) === norm(name));
  const getCurrentMap = (warehouse, asOfDate) => {
    const whArr = Array.isArray(warehouse) ? warehouse : null;
    const isAll = whArr ? whArr.length === 0 : warehouse === ALL_WAREHOUSES;
    const matchWh = (w) => isAll || !w || (whArr ? whArr.includes(w) : w === warehouse);
    const masukMap = new Map();
    for (const m of movements) {
      if (m.type !== "masuk") continue;
      if (!matchWh(m.warehouse)) continue;
      const mDate = m.date || (m.created_date || "").slice(0, 10);
      if (asOfDate && mDate > asOfDate) continue;
      const k = norm(m.item_name);
      if (!k) continue;
      masukMap.set(k, (masukMap.get(k) || 0) + convertToBase(itemByName(m.item_name), m.quantity, m.unit));
    }
    const keluarMap = new Map();
    for (const s of shipments) {
      if (s.status !== "sudah_dikirim") continue;
      if (!matchWh(s.warehouse)) continue;
      if (asOfDate && (s.delivery_date || "") > asOfDate) continue;
      for (const it of (Array.isArray(s.do_items) ? s.do_items : [])) {
        const k = norm(it.name);
        if (!k) continue;
        keluarMap.set(k, (keluarMap.get(k) || 0) + convertToBase(itemByName(it.name), it.quantity, it.unit));
      }
    }
    for (const m of movements) {
      if (m.type !== "keluar") continue;
      if (!matchWh(m.warehouse)) continue;
      const mDate = m.date || (m.created_date || "").slice(0, 10);
      if (asOfDate && mDate > asOfDate) continue;
      const k = norm(m.item_name);
      if (!k) continue;
      keluarMap.set(k, (keluarMap.get(k) || 0) + convertToBase(itemByName(m.item_name), m.quantity, m.unit));
    }
    return { masukMap, keluarMap };
  };
  const rows = useMemo(() => {
    const { masukMap, keluarMap } = getCurrentMap(wh, stockDate);
    const seen = new Map();
    for (const it of items) {
      const k = norm(it.name);
      if (!k) continue;
      if (wh.length > 0 && Array.isArray(it.warehouses) && it.warehouses.length > 0 && !it.warehouses.some((w) => wh.includes(w))) continue;
      const masuk = masukMap.get(k) || 0;
      const keluar = keluarMap.get(k) || 0;
      const current = masuk - keluar;
      const displayUnit = getBaseUnit(it) || it.unit || "";
      const min = convertToBase(it, Number(it.min_stock || 0), it.unit);
      if (seen.has(k)) {
        const prev = seen.get(k);
        prev.min_stock = Math.max(prev.min_stock || 0, min);
      } else {
        seen.set(k, { ...it, masuk, keluar, current, low: current < min, min_stock: min, displayUnit });
      }
    }
    return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name, "id"));
  }, [items, movements, shipments, wh, stockDate]);
  const ctrlStock = useMemo(() => getCurrentMap(whCtrl || ALL_WAREHOUSES), [whCtrl, movements, shipments]);
  const currentFor = (name) => { const k = norm(name); return (ctrlStock.masukMap.get(k) || 0) - (ctrlStock.keluarMap.get(k) || 0); };

  const openAdd = () => {
    setEditing(null);
    setFName(""); setFCode(""); setFUnits([{ name: "", conversion: 1, is_base: true }]); setFMin(""); setFCat(""); setFGramasi(""); setFWarehouses([]);
    setItemDialog(true);
  };
  const openEdit = (it) => {
    setEditing(it);
    const units = Array.isArray(it.units) && it.units.length > 0
      ? it.units
      : [{ name: it.unit || "", conversion: 1, is_base: true }];
    setFName(it.name || ""); setFCode(it.code || ""); setFUnits(units); setFMin(String(it.min_stock ?? "")); setFCat(it.category || ""); setFGramasi(String(it.gramasi ?? "")); setFWarehouses(Array.isArray(it.warehouses) ? it.warehouses : []);
    setItemDialog(true);
  };

  const saveItem = async () => {
    if (!fName.trim()) return;
    setBusy(true);
    try {
      const cleanUnits = fUnits.filter((u) => u.name && u.name.trim());
      const base = cleanUnits.find((u) => u.is_base) || cleanUnits[0] || {};
      const units = cleanUnits.map((u) => ({ name: u.name.trim(), conversion: Number(u.conversion) || 1, is_base: u === base }));
      const payload = { name: fName.trim(), code: fCode.trim(), unit: base.name || "", units, min_stock: Number(fMin) || 0, category: fCat.trim(), gramasi: Number(fGramasi) || 0, warehouses: fWarehouses };
      if (editing) await base44.entities.StockItem.update(editing.id, payload);
      else await base44.entities.StockItem.create(payload);
      setItemDialog(false);
      refresh();
    } finally { setBusy(false); }
  };

  const removeItem = async () => {
    const id = confirmId;
    setConfirmId(null);
    if (!id) return;
    setBusy(true);
    try { await base44.entities.StockItem.delete(id); refresh(); } finally { setBusy(false); }
  };

  const removeBulk = async () => {
    const ids = [...selectedIds];
    setConfirmBulk(false);
    if (!ids.length) return;
    setBusy(true);
    try {
      await Promise.all(ids.map((id) => base44.entities.StockItem.delete(id)));
      setSelectedIds(new Set());
      refresh();
    } finally { setBusy(false); }
  };

  const q = search.trim().toLowerCase();
  const filtered = rows.filter((r) => !q || String(r.name || "").toLowerCase().includes(q) || String(r.code || "").toLowerCase().includes(q));
  const categories = useMemo(() => { const set = new Set(); for (const r of filtered) set.add((r.category || "").trim() || "(Tanpa Kategori)"); return [...set].sort((a, b) => a.localeCompare(b, "id")); }, [filtered]);

  const toggleSelect = (id) => setSelectedIds((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const allFilteredSelected = filtered.length > 0 && filtered.every((r) => selectedIds.has(r.id));
  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filtered.forEach((r) => next.delete(r.id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filtered.forEach((r) => next.add(r.id));
        return next;
      });
    }
  };

  const openCtrl = () => { setCtrlRows([blankRow()]); setWhCtrl(wh.length === 1 ? wh[0] : ""); setCtrlType("adjustment"); setCtrlDate(today()); setWhCtrlTo(""); setCtrlOpen(true); };
  const onSourceWhChange = (v) => { setWhCtrl(v); if (v === whCtrlTo) setWhCtrlTo(""); };
  const addCtrlRow = () => setCtrlRows((p) => [...p, blankRow()]);
  const removeCtrlRow = (i) => setCtrlRows((p) => p.filter((_, idx) => idx !== i));
  const setCtrlField = (i, field, value) => setCtrlRows((p) => p.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
  const submitCtrl = async () => {
    const valid = ctrlRows.filter((r) => r.itemId && Number(r.qty) > 0 && r.unit);
    if (!valid.length) return;
    if (ctrlType === "transfer" && (!whCtrl || !whCtrlTo || whCtrl === whCtrlTo)) return;
    setBusy(true);
    try {
      const payload = [];
      for (const r of valid) {
        const it = items.find((i) => i.id === r.itemId);
        const name = it?.name || "";
        const unit = r.unit || it?.unit || "";
        const qty = Number(r.qty);
        const date = ctrlDate || today();
        const note = r.note.trim();
        if (ctrlType === "transfer") {
          payload.push({ item_name: name, type: "keluar", quantity: qty, unit, note: `Transfer ke ${whCtrlTo}${note ? " - " + note : ""}`, reference: "transfer", date, warehouse: whCtrl });
          payload.push({ item_name: name, type: "masuk", quantity: qty, unit, note: `Transfer dari ${whCtrl}${note ? " - " + note : ""}`, reference: "transfer", date, warehouse: whCtrlTo });
        } else {
          const mvType = r.adjType === "kurang" ? "keluar" : "masuk";
          payload.push({ item_name: name, type: mvType, quantity: qty, unit, note, reference: "manual", date, warehouse: whCtrl });
        }
      }
      await base44.entities.StockMovement.bulkCreate(payload);
      setCtrlOpen(false);
      setCtrlRows([]);
      refresh();
    } finally { setBusy(false); }
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ["Nama Barang", "Kode", "Satuan 1", "Konversi 1", "Satuan 2", "Konversi 2", "Satuan 3", "Konversi 3", "Satuan 4", "Konversi 4", "Satuan 5", "Konversi 5", "Gramasi (kg/satuan dasar)", "Min Stok", "Kategori", "Gudang"],
      ["Ayam Crispy", "BRG001", "pack", 1, "dus", 12, "", "", "", "", "", "", 0.5, 10, "Frozen", "Gudang Jakarta, Gudang Surabaya"],
      ["Tepung Terigu", "BRG002", "sak", 1, "", "", "", "", "", "", "", "", 25, 5, "Bahan Baku", ""],
    ]);
    ws["!cols"] = [{ wch: 24 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 20 }, { wch: 10 }, { wch: 16 }, { wch: 30 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template Barang");
    XLSX.writeFile(wb, "template-import-barang.xlsx");
  };

  const downloadTransactionTemplate = () => {
    const wb = XLSX.utils.book_new();
    const cols = (c) => c.map(() => ({ wch: 18 }));
    const wsAdj = XLSX.utils.aoa_to_sheet([
      ["Tanggal", "Gudang", "Tipe Adjustment", "Nama Barang", "Jumlah", "Satuan", "Keterangan"],
      ["2026-01-01", "Gudang Jakarta", "Tambah", "Tepung Terigu", 100, "sak", "Pembelian"],
      ["2026-01-02", "Gudang Jakarta", "Kurang", "Tepung Terigu", 20, "sak", "Pemakaian internal"],
    ]);
    wsAdj["!cols"] = cols([0, 0, 0, 0, 0, 0, 0]);
    XLSX.utils.book_append_sheet(wb, wsAdj, "Adjustment Stock");
    const wsTransfer = XLSX.utils.aoa_to_sheet([["Tanggal", "Gudang Asal", "Gudang Tujuan", "Nama Barang", "Jumlah", "Satuan", "Keterangan"], ["2026-01-01", "Gudang Jakarta", "Gudang Surabaya", "Tepung Terigu", 50, "sak", "Mutasi antar gudang"]]);
    wsTransfer["!cols"] = cols([0, 0, 0, 0, 0, 0, 0]);
    XLSX.utils.book_append_sheet(wb, wsTransfer, "Transfer Stock");
    XLSX.writeFile(wb, "template-transaksi-stok.xlsx");
  };

  const handleImport = async (file) => {
    if (!file) return;
    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(ws, { defval: "" });
      const existing = new Set(items.map((o) => normKey(o.name)));
      const grouped = new Map();
      for (const row of data) {
        const name = String(row["Nama Barang"] || row["name"] || row["Nama"] || "").trim();
        if (!name || existing.has(normKey(name))) continue;
        const unitRows = [];
        for (let i = 1; i <= 5; i++) {
          const uName = String(row[`Satuan ${i}`] || "").trim();
          if (!uName) continue;
          const conv = Number(row[`Konversi ${i}`] || 1) || 1;
          unitRows.push({ name: uName, conversion: conv });
        }
        if (!unitRows.length) continue;
        const k = normKey(name);
        if (!grouped.has(k)) {
          grouped.set(k, {
            name,
            code: String(row["Kode"] || row["code"] || "").trim(),
            gramasi: Number(row["Gramasi (kg/satuan dasar)"] || row["Gramasi (kg/satuan)"] || row["gramasi"] || 0) || 0,
            min_stock: Number(row["Min Stok"] || row["min_stock"] || row["Min"] || 0) || 0,
            category: String(row["Kategori"] || row["category"] || "").trim(),
            warehouses: String(row["Gudang"] || "").split(",").map((w) => w.trim()).filter(Boolean),
            unitRows,
          });
        }
      }
      const toCreate = [...grouped.values()].map((g) => {
        const baseIdx = g.unitRows.findIndex((u) => Number(u.conversion) === 1);
        const baseRow = baseIdx >= 0 ? g.unitRows[baseIdx] : g.unitRows[0];
        const units = g.unitRows.map((u) => ({ name: u.name, conversion: Number(u.conversion) || 1, is_base: u === baseRow }));
        return { name: g.name, code: g.code, unit: baseRow.name, units, gramasi: g.gramasi, min_stock: g.min_stock, category: g.category, warehouses: g.warehouses };
      });
      setItemPreview(toCreate);
    } catch {
      alert("Gagal mengimpor file. Pastikan format sesuai template.");
    } finally { setBusy(false); }
  };

  const submitBulkWarehouse = async () => {
    setBusy(true);
    try {
      const ids = [...selectedIds];
      await base44.entities.StockItem.bulkUpdate(ids.map((id) => ({ id, warehouses: bulkWhValue })));
      setBulkWhOpen(false);
      setSelectedIds(new Set());
      refresh();
      alert(`${ids.length} barang berhasil diperbarui gudangnya.`);
    } catch {
      alert("Gagal memperbarui gudang barang.");
    } finally { setBusy(false); }
  };

  const submitItemPreview = async (list) => {
    if (!list?.length) { setItemPreview(null); return; }
    setBusy(true);
    try {
      await base44.entities.StockItem.bulkCreate(list);
      setItemPreview(null);
      refresh();
      alert(`${list.length} barang berhasil diimpor.`);
    } catch {
      alert("Gagal menyimpan data barang.");
    } finally { setBusy(false); }
  };

  const handleImportTransaction = async (file) => {
    if (!file) return;
    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellDates: true });
      const preview = [];
      const readSheet = (sheetName, type) => {
        const ws = wb.Sheets[sheetName];
        if (!ws) return;
        const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
        for (const row of rows) {
          const name = String(row["Nama Barang"] || "").trim();
          if (!name) continue;
          const qty = Number(row["Jumlah"] || 0);
          if (!qty) continue;
          const date = parseExcelDate(row["Tanggal"]) || today();
          const unit = String(row["Satuan"] || "").trim();
          const note = String(row["Keterangan"] || "").trim();
          if (type === "transfer") {
            const from = String(row["Gudang Asal"] || "").trim();
            const to = String(row["Gudang Tujuan"] || "").trim();
            if (!from || !to || from === to) continue;
            preview.push({ item_name: name, type: "transfer", quantity: qty, unit, note, date, warehouse: from, transferTo: to });
          } else if (type === "adjustment") {
            const wh = String(row["Gudang"] || "").trim();
            if (!wh) continue;
            const adjType = String(row["Tipe Adjustment"] || "").trim().toLowerCase();
            const mvType = adjType.startsWith("kurang") ? "keluar" : "masuk";
            preview.push({ item_name: name, type: mvType, quantity: qty, unit, note, date, warehouse: wh });
          }
        }
      };
      readSheet("Adjustment Stock", "adjustment");
      readSheet("Transfer Stock", "transfer");
      setTxPreview(preview);
    } catch {
      alert("Gagal mengimpor file. Pastikan format sesuai template transaksi.");
    } finally { setBusy(false); }
  };

  const submitTxPreview = async (rows) => {
    if (!rows?.length) return;
    setBusy(true);
    try {
      const payload = [];
      for (const r of rows) {
        if (r.type === "transfer") {
          payload.push({ item_name: r.item_name, type: "keluar", quantity: r.quantity, unit: r.unit, note: `Transfer ke ${r.transferTo}${r.note ? " - " + r.note : ""}`, reference: "transfer", date: r.date, warehouse: r.warehouse });
          payload.push({ item_name: r.item_name, type: "masuk", quantity: r.quantity, unit: r.unit, note: `Transfer dari ${r.warehouse}${r.note ? " - " + r.note : ""}`, reference: "transfer", date: r.date, warehouse: r.transferTo });
        } else {
          payload.push({ item_name: r.item_name, type: r.type, quantity: r.quantity, unit: r.unit, note: r.note, reference: "import", date: r.date, warehouse: r.warehouse });
        }
      }
      await base44.entities.StockMovement.bulkCreate(payload);
      setTxPreview(null);
      refresh();
      alert(`${payload.length} transaksi berhasil diproses.`);
    } catch {
      alert("Gagal memproses transaksi.");
    } finally { setBusy(false); }
  };

  return (
    <div>
      <div className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-indigo-600">Inventory</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Stock Control</h1>
          </div>
          <button onClick={() => setScanOpen(true)} className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"><ScanLine className="h-4 w-4" />Scan Barcode</button>
        </div>
        <p className="mt-2 text-sm text-slate-500">Kelola daftar barang dan stok. Stok bertambah saat input masuk dan berkurang otomatis saat pengiriman berstatus Sudah Dikirim, sesuai gudang terkait.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {canItemAdd && <StockImportButton label="Tambah Barang" icon={<Plus className="h-4 w-4" />} onMainClick={openAdd} onImport={handleImport} onDownloadTemplate={downloadTemplate} disabled={busy} />}
          {canIn && <StockImportButton label="Buat Transaksi" icon={<PackagePlus className="h-4 w-4" />} variant="primary" onMainClick={openCtrl} onImport={handleImportTransaction} onDownloadTemplate={downloadTransactionTemplate} disabled={busy} importLabel="Impor Data Transaksi (.xlsx)" templateLabel="Download Template (.xlsx)" />}
        </div>
      </div>

      <div className="mb-4 inline-flex rounded-xl border border-slate-200 bg-white p-1">
        <button onClick={() => setTab("items")} className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition ${tab === "items" ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}>Daftar Barang</button>
        {canViewTx && <button onClick={() => setTab("riwayat")} className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-semibold transition ${tab === "riwayat" ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}><History className="h-3.5 w-3.5" />Riwayat</button>}
        <button onClick={() => setTab("barcode")} className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-semibold transition ${tab === "barcode" ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}><ScanLine className="h-3.5 w-3.5" />Barcode Center</button>
      </div>
      {tab !== "riwayat" && tab !== "barcode" && (
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <WarehouseMultiSelect value={wh} onChange={setWh} className="w-full sm:w-[220px]" />
        <label className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">Kondisi per</span>
          <input type="date" value={stockDate} onChange={(e) => setStockDate(e.target.value || today())} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" />
        </label>
        {tab === "items" && <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nama atau kode barang..." className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" />
        </div>}
      </div>
      )}

      {tab === "barcode" ? (
        <BarcodeCenterPanel />
      ) : tab === "riwayat" ? (
        <StockHistory />
      ) : isLoading ? (
        <div className="flex justify-center py-16"><div className="h-7 w-7 animate-spin rounded-full border-4 border-indigo-100 border-t-indigo-600" /></div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center">
          <Boxes className="h-8 w-8 text-slate-300" />
          <p className="mt-3 text-sm text-slate-500">Belum ada data barang. {canItemAdd && "Klik Tambah Barang untuk memulai."}</p>
        </div>
      ) : (
        <>
          {(canItemDelete || canItemEdit) && (
            <div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-600">
                <Checkbox checked={allFilteredSelected} onCheckedChange={toggleSelectAll} />
                Pilih Semua
              </label>
              {selectedIds.size > 0 && (
                <>
                  <span className="text-sm text-slate-500">{selectedIds.size} dipilih</span>
                  {canItemEdit && <button onClick={() => { setBulkWhValue([]); setBulkWhOpen(true); }} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-50 px-3 py-1.5 text-sm font-semibold text-indigo-600 transition hover:bg-indigo-100 disabled:opacity-50">
                    <Warehouse className="h-3.5 w-3.5" />Atur Gudang Penempatan
                  </button>}
                  {canItemDelete && <button onClick={() => setConfirmBulk(true)} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-1.5 text-sm font-semibold text-red-600 transition hover:bg-red-100 disabled:opacity-50">
                    <Trash2 className="h-3.5 w-3.5" />Hapus Terpilih
                  </button>}
                  <button onClick={() => setSelectedIds(new Set())} disabled={busy} className="text-sm font-medium text-slate-500 hover:text-slate-700">Batal</button>
                </>
              )}
            </div>
          )}
          <Accordion type="multiple" defaultValue={[]} className="w-full">
            {categories.map((cat) => {
              const catItems = filtered.filter((r) => ((r.category || "").trim() || "(Tanpa Kategori)") === cat);
              return (
                <AccordionItem key={cat} value={cat}>
                  <AccordionTrigger className="text-sm font-bold text-slate-800">{cat} ({catItems.length})</AccordionTrigger>
                  <AccordionContent>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {catItems.map((r) => (
                        <div key={r.id} className={`flex flex-col rounded-2xl border bg-white p-4 shadow-sm transition ${selectedIds.has(r.id) ? "border-indigo-400 ring-2 ring-indigo-100" : "border-slate-200"}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 min-w-0">
                    {(canItemDelete || canItemEdit) && (
                      <Checkbox checked={selectedIds.has(r.id)} onCheckedChange={() => toggleSelect(r.id)} className="mt-0.5" />
                    )}
                    <button type="button" onClick={() => openHistory(r)} className="flex flex-col text-left transition hover:bg-slate-50/60 -mx-1 -mt-1 px-1 pt-1 rounded-xl min-w-0">
                      <p className="truncate text-sm font-bold text-slate-800">{r.name}</p>
                      <p className="text-xs text-slate-400">{r.code || "tanpa kode"} · {r.category || "-"}</p>
                    </button>
                  </div>
                  {r.low && <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-600"><AlertTriangle className="h-3 w-3" />Menipis</span>}
                </div>
                <button type="button" onClick={() => openHistory(r)} className="flex flex-col text-left transition hover:bg-slate-50/60 -mx-1 px-1 pb-1 rounded-xl">
                  <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{Number(r.current).toLocaleString("id-ID")} <span className="text-sm font-medium text-slate-400">{r.displayUnit || r.unit || ""}</span></p>
                  {Array.isArray(r.units) && r.units.length > 1 && (
                    <p className="mt-1 text-[11px] font-medium text-slate-400">Satuan: {r.units.map((u) => u.name).join(", ")}</p>
                  )}
                  {Number(r.gramasi) > 0 && <p className="mt-1 text-[11px] font-medium text-slate-400">Gramasi: {Number(r.gramasi).toLocaleString("id-ID")} kg/{r.displayUnit || r.unit || "unit"}</p>}
                  <div className="mt-3 flex items-center gap-3 text-xs">
                    <span className="text-emerald-600">+{Number(r.masuk).toLocaleString("id-ID")} masuk</span>
                    <span className="text-rose-500">-{Number(r.keluar).toLocaleString("id-ID")} keluar</span>
                    <span className="ml-auto text-slate-400">min {Number(r.min_stock || 0).toLocaleString("id-ID")}</span>
                  </div>
                  <p className="mt-1.5 text-[11px] font-medium text-indigo-500">Klik untuk lihat riwayat pergerakan →</p>
                </button>
                {(canItemEdit || canItemDelete) && (
                  <div className="mt-3 flex items-center justify-end gap-1 border-t border-slate-100 pt-2">
                    {canItemEdit && <button onClick={() => openEdit(r)} disabled={busy} className="rounded-lg p-1.5 text-slate-600 transition hover:bg-slate-100" title="Edit"><Pencil className="h-3.5 w-3.5" /></button>}
                    {canItemDelete && <button onClick={() => setConfirmId(r.id)} disabled={busy} className="rounded-lg p-1.5 text-red-600 transition hover:bg-red-50" title="Hapus"><Trash2 className="h-3.5 w-3.5" /></button>}
                  </div>
                )}
              </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
              );
            })}
          </Accordion>
        </>
      )}

      <Dialog open={itemDialog} onOpenChange={(o) => !o && setItemDialog(false)}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Edit Barang" : "Tambah Barang"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <label className="text-sm font-medium">Nama Barang<input value={fName} onChange={(e) => setFName(e.target.value)} className={`mt-1.5 ${inputClass}`} placeholder="Nama barang" /></label>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm font-medium">Kode<input value={fCode} onChange={(e) => setFCode(e.target.value)} className={`mt-1.5 ${inputClass}`} placeholder="Kode" /></label>
              <label className="text-sm font-medium">Kategori
                <FormSelect value={fCat || "__none__"} onValueChange={(v) => setFCat(v === "__none__" ? "" : v)} placeholder="- Tanpa Kategori -" options={[{value: "__none__", label: "- Tanpa Kategori -"}, ...categoryNames.map((c) => ({value: c, label: c}))]} className={`mt-1.5 ${inputClass}`} />
              </label>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-3">
              <p className="mb-2 text-sm font-medium text-slate-700">Satuan & Konversi</p>
              <UnitEditor units={fUnits} onChange={setFUnits} disabled={busy} />
            </div>
            <label className="text-sm font-medium">Gramasi (kg per satuan dasar)<input type="number" min="0" step="0.1" value={fGramasi} onChange={(e) => setFGramasi(e.target.value)} className={`mt-1.5 ${inputClass}`} placeholder="0" /></label>
            <p className="-mt-1 text-[11px] text-slate-400">Berat per satuan dasar. Dipakai untuk menghitung tonase otomatis di pengiriman & penerimaan.</p>
            <label className="text-sm font-medium">Min Stok<input type="number" min="0" value={fMin} onChange={(e) => setFMin(e.target.value)} className={`mt-1.5 ${inputClass}`} placeholder="0" /></label>
            <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-3">
              <p className="mb-1 text-sm font-medium text-slate-700">Gudang Penempatan</p>
              <p className="mb-2 text-[11px] text-slate-400">Pilih gudang tempat barang tersedia. Kosongkan untuk semua gudang.</p>
              <div className="flex flex-wrap gap-2">
                {warehouseList.map((w) => w.name).slice().sort((a, b) => a.localeCompare(b, "id")).map((w) => (
                  <label key={w} className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600">
                    <Checkbox checked={fWarehouses.includes(w)} onCheckedChange={() => setFWarehouses((prev) => prev.includes(w) ? prev.filter((x) => x !== w) : [...prev, w])} />
                    {w}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setItemDialog(false)}>Batal</Button><Button onClick={saveItem} disabled={busy || !fName.trim()}>{busy ? "Menyimpan..." : "Simpan"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={ctrlOpen} onOpenChange={(o) => !o && setCtrlOpen(false)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Buat Transaksi</DialogTitle></DialogHeader>
          <p className="-mt-2 text-xs text-slate-500">Tambah, kurangi, atau transfer stok untuk satu atau beberapa barang sekaligus.</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block text-sm font-medium">Tanggal
              <input type="date" value={ctrlDate} onChange={(e) => setCtrlDate(e.target.value || today())} className={`mt-1.5 w-full ${inputClass}`} />
            </label>
            <label className="block text-sm font-medium">Pilih Gudang
              <FormSelect value={whCtrl || undefined} onValueChange={onSourceWhChange} placeholder="Pilih gudang" options={warehouseList.map((w) => ({ name: w.name, pic: w.pic || "" })).slice().sort((a, b) => a.name.localeCompare(b.name, "id")).map((w) => ({ value: w.name, label: w.name + (w.pic ? ` (PIC: ${w.pic})` : "") }))} className={`mt-1.5 w-full ${inputClass}`} />
            </label>
            <label className="block text-sm font-medium">Tipe Transaksi
              <FormSelect value={ctrlType} onValueChange={setCtrlType} options={[{value: "adjustment", label: "Adjustment Stock"}, {value: "transfer", label: "Transfer Stock"}]} className={`mt-1.5 w-full ${inputClass}`} />
            </label>
            {ctrlType === "transfer" && <label className="block text-sm font-medium sm:col-span-3">Gudang Tujuan<div className="mt-1.5"><FormSelect value={whCtrlTo || undefined} onValueChange={setWhCtrlTo} placeholder="Pilih gudang tujuan" options={destWarehouses.map((w) => ({value: w, label: w}))} className={`w-full ${inputClass}`} disabled={!whCtrl} /></div></label>}
          </div>
          {ctrlType === "transfer" && <p className="-mt-1 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">Transfer akan mengurangi stok dari <b>{whCtrl || "gudang asal"}</b> dan menambah stok ke <b>{whCtrlTo || "gudang tujuan"}</b>.</p>}
          <div className="max-h-[50vh] space-y-3 overflow-y-auto">
            {ctrlRows.map((row, i) => {
              const sel = items.find((it) => it.id === row.itemId);
              return (
                <div key={i} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex items-center gap-2">
                    <FormSelect value={row.itemId || undefined} onValueChange={(v) => { const it = items.find((x) => x.id === v); const baseU = Array.isArray(it?.units) && it.units.length ? (it.units.find((u) => u.is_base) || it.units[0]) : null; setCtrlField(i, "itemId", v); setCtrlField(i, "unit", baseU?.name || it?.unit || ""); }} placeholder="Pilih barang" options={rows.map((it) => ({value: it.id, label: `${it.name} — Stok: ${Number(currentFor(it.name)).toLocaleString("id-ID")} ${it.unit || ""}`}))} className={`flex-1 ${inputClass}`} />
                    <button type="button" onClick={() => setScanRowIdx(i)} className="rounded-lg p-2 text-indigo-600 transition hover:bg-indigo-50" title="Scan barcode"><ScanLine className="h-4 w-4" /></button>
                    {ctrlRows.length > 1 && <button type="button" onClick={() => removeCtrlRow(i)} className="rounded-lg p-2 text-red-600 transition hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>}
                  </div>
                  {row.itemId && <p className="mt-1 text-xs text-slate-500">Stok saat ini (gudang {whCtrl || "Semua"}): <span className="font-semibold text-slate-700">{Number(currentFor(sel?.name || "")).toLocaleString("id-ID")} {sel?.unit || ""}</span></p>}
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <label className="text-xs font-medium">Jumlah<input type="number" min="0" value={row.qty} onChange={(e) => setCtrlField(i, "qty", e.target.value)} className={`mt-1 ${inputClass}`} placeholder="0" /></label>
                    <label className="text-xs font-medium">Satuan
                      <FormSelect value={row.unit || undefined} onValueChange={(v) => setCtrlField(i, "unit", v)} placeholder="Pilih satuan" options={(Array.isArray(sel?.units) && sel.units.length ? sel.units : (sel?.unit ? [{ name: sel.unit, conversion: 1 }] : [])).map((u) => ({value: u.name, label: u.name}))} className={`mt-1 ${inputClass}`} disabled={!row.itemId} />
                    </label>
                    {ctrlType === "adjustment" && <label className="text-xs font-medium">Tipe Adjustment
                      <FormSelect value={row.adjType || "tambah"} onValueChange={(v) => setCtrlField(i, "adjType", v)} options={[{value: "tambah", label: "Tambahkan"}, {value: "kurang", label: "Kurangi"}]} className={`mt-1 ${inputClass}`} />
                    </label>}
                    <label className="text-xs font-medium sm:col-span-1">Keterangan<input value={row.note} onChange={(e) => setCtrlField(i, "note", e.target.value)} className={`mt-1 ${inputClass}`} placeholder="Catatan" /></label>
                  </div>
                </div>
              );
            })}
          </div>
          <button type="button" onClick={addCtrlRow} className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-slate-300 px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"><Plus className="h-4 w-4" />Tambah Baris</button>
          <DialogFooter><Button variant="outline" onClick={() => setCtrlOpen(false)}>Batal</Button><Button onClick={submitCtrl} disabled={busy || !whCtrl || (ctrlType === "transfer" && (!whCtrlTo || whCtrlTo === whCtrl)) || !ctrlRows.some((r) => r.itemId && Number(r.qty) > 0 && r.unit)}>{busy ? "Menyimpan..." : "Simpan"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog open={!!confirmId} onClose={() => setConfirmId(null)} onConfirm={removeItem} />
      <ConfirmDeleteDialog open={confirmBulk} onClose={() => setConfirmBulk(false)} onConfirm={removeBulk} count={selectedIds.size} />

      <StockMovementDialog open={!!historyItem} onClose={closeHistory} itemName={historyItem?.name || ""} warehouse={wh} asOfDate={stockDate} />
      <StockTransactionReviewDialog open={!!txPreview} rows={txPreview || []} onClose={() => setTxPreview(null)} onSubmit={submitTxPreview} />
      <StockItemReviewDialog open={!!itemPreview} items={itemPreview || []} onClose={() => setItemPreview(null)} onSubmit={submitItemPreview} />
      <Dialog open={bulkWhOpen} onOpenChange={(o) => !o && setBulkWhOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Atur Gudang Penempatan</DialogTitle></DialogHeader>
          <p className="text-sm text-slate-500">Pilih gudang untuk <b>{selectedIds.size}</b> barang terpilih. Kosongkan untuk semua gudang.</p>
          <div className="flex flex-wrap gap-2">
            {warehouseList.map((w) => w.name).slice().sort((a, b) => a.localeCompare(b, "id")).map((w) => (
              <label key={w} className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600">
                <Checkbox checked={bulkWhValue.includes(w)} onCheckedChange={() => setBulkWhValue((prev) => prev.includes(w) ? prev.filter((x) => x !== w) : [...prev, w])} />
                {w}
              </label>
            ))}
          </div>
          {warehouseList.length === 0 && <p className="text-xs text-amber-600">Belum ada gudang di master data. Tambahkan gudang di halaman Master Data terlebih dahulu.</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkWhOpen(false)}>Batal</Button>
            <Button onClick={submitBulkWarehouse} disabled={busy || selectedIds.size === 0}>{busy ? "Menyimpan..." : "Terapkan"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {scanRowIdx !== null && <BarcodeScanner onScan={onScanCtrl} onClose={() => setScanRowIdx(null)} title="Scan Barcode Barang" />}
      <StockScanDialog open={scanOpen} onClose={() => setScanOpen(false)} onStockCheck={(item) => { setTab("items"); openHistory(item); setScanOpen(false); }} />
    </div>
  );
}
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Trash2, Calculator, AlertTriangle, Plus } from "lucide-react";
import WarehouseSelect from "@/components/shipping/WarehouseSelect";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ALL_WAREHOUSES } from "./shippingUtils";
import { useStockCurrent } from "@/components/shipping/useStockCurrent";
import QuickAddMasterDialog from "./QuickAddMasterDialog";
import { usePermissions } from "./usePermissions";

const normKey = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

const inputClass = "mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";

let rowIdCounter = 0;
const genRowId = () => `imp-${++rowIdCounter}`;

export default function ImportReviewDialog({ open, dos, defaultWarehouse, onClose, onSubmit }) {
  const [rows, setRows] = useState([]);
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [addType, setAddType] = useState(null);
  const [addName, setAddName] = useState("");
  const { calcTonnage } = useStockCurrent();
  const calcTonnageRef = useRef(calcTonnage);
  calcTonnageRef.current = calcTonnage;
  const qc = useQueryClient();
  const { can } = usePermissions();
  const canItemAdd = can("stock.manage");
  const canWarehouseAdd = can("master.warehouse_add");

  const { data: masterItems = [] } = useQuery({ queryKey: ["stockItems"], queryFn: () => base44.entities.StockItem.list() });
  const { data: masterOutlets = [] } = useQuery({ queryKey: ["outlets"], queryFn: () => base44.entities.Outlet.list() });
  const { data: masterWarehouses = [] } = useQuery({ queryKey: ["warehouses"], queryFn: () => base44.entities.Warehouse.list() });
  const { data: fleets = [] } = useQuery({ queryKey: ["fleets"], queryFn: () => base44.entities.Fleet.list() });
  const { data: existingShipments = [] } = useQuery({ queryKey: ["shipments", "import-check"], queryFn: () => base44.entities.Shipment.list("-created_date", 500) });
  const sortedFleets = useMemo(() => [...fleets].sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "id")), [fleets]);

  const missingItems = useMemo(() => {
    const nameSet = new Set(masterItems.map((i) => normKey(i.name)));
    const codeSet = new Set(masterItems.map((i) => normKey(i.code)).filter(Boolean));
    const res = new Set();
    for (const r of rows) for (const it of (r.do_items || [])) {
      const nm = String(it.name || "").trim();
      const cd = String(it.code || "").trim();
      if (!nm) continue;
      if (nameSet.has(normKey(nm))) continue;
      if (cd && codeSet.has(normKey(cd))) continue;
      res.add(nm);
    }
    return [...res].sort();
  }, [rows, masterItems]);
  const missingOutlets = useMemo(() => {
    const set = new Set(masterOutlets.map((o) => normKey(o.name)));
    const res = new Set();
    for (const r of rows) { const nm = String(r.outlet_name || "").trim(); if (nm && !set.has(normKey(nm))) res.add(nm); }
    return [...res].sort();
  }, [rows, masterOutlets]);
  const missingWarehouses = useMemo(() => {
    const set = new Set(masterWarehouses.map((w) => normKey(w.name)));
    const res = new Set();
    for (const r of rows) { const nm = String(r.warehouse || "").trim(); if (nm && !set.has(normKey(nm))) res.add(nm); }
    return [...res].sort();
  }, [rows, masterWarehouses]);
  const hasMissing = missingItems.length > 0 || missingWarehouses.length > 0;
  const duplicateDos = useMemo(() => {
    const existing = new Set(existingShipments.filter((s) => s.do_number).map((s) => normKey(s.do_number)));
    const seen = new Set();
    const dups = [];
    for (const r of rows) {
      if (!r.do_number) continue;
      const k = normKey(r.do_number);
      if (existing.has(k) || seen.has(k)) dups.push(r.do_number);
      seen.add(k);
    }
    return [...new Set(dups)];
  }, [rows, existingShipments]);
  const hasDuplicates = duplicateDos.length > 0;
  const fmtTon = (v) => (Math.round(Number(v || 0) * 100) / 100).toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const grandTotalTonnage = rows.reduce((sum, r) => sum + (Number(r.tonnage) || 0), 0);

  useEffect(() => {
    if (open && dos?.length) {
      setRows(dos.map((d) => {
        const doItems = Array.isArray(d.do_items) ? d.do_items : [];
        return {
          _rid: genRowId(),
          do_number: d.do_number || "",
          outlet_name: d.outlet_name || "",
          delivery_date: d.delivery_date || "",
          do_items: doItems,
          document_type: d.document_type || "delivery_order",
          tonnage: calcTonnageRef.current(doItems),
          warehouse: d.warehouse || (defaultWarehouse && defaultWarehouse !== ALL_WAREHOUSES ? defaultWarehouse : ""),
          fleet: "",
        };
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, dos, defaultWarehouse]);

  const update = (idx, field, value) => setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
  const removeRow = (idx) => setRows((prev) => prev.filter((_, i) => i !== idx));
  const confirmDelete = () => { if (pendingDelete !== null) { removeRow(pendingDelete); setPendingDelete(null); } };

  const submit = async () => {
    setSaving(true);
    try {
      const existingOutletKeys = new Set(masterOutlets.map((o) => normKey(o.name)));
      const newOutlets = missingOutlets.filter((nm) => !existingOutletKeys.has(normKey(nm))).map((nm) => ({ name: nm }));
      if (newOutlets.length) {
        await base44.entities.Outlet.bulkCreate(newOutlets).catch(() => {});
        qc.invalidateQueries({ queryKey: ["outlets"] });
      }
      const payload = rows.map((r) => ({
        outlet_name: r.outlet_name,
        tonnage: Number(r.tonnage) || 0,
        status: "menunggu_antrian",
        fleet: r.fleet || "",
        delivery_date: r.delivery_date,
        warehouse: r.warehouse,
        checker_name: "",
        crew_count: 0,
        do_number: r.do_number || "",
        document_type: r.document_type || "delivery_order",
        do_items: r.do_items,
      }));
      await onSubmit(payload);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Konfirmasi Data Impor</DialogTitle>
            <p className="text-sm text-slate-500">{rows.length} pengiriman terbaca. Gudang asal terbaca otomatis. Tonase dapat diisi sekarang atau diperbaiki nanti pada detail DO.</p>
          </DialogHeader>

          <div className="space-y-4">
            {hasMissing && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
                <div className="flex items-center gap-2 text-amber-700">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <p className="text-sm font-semibold">Data Belum Terdaftar di Master</p>
                </div>
                <p className="mt-1 text-xs text-amber-600">Data berikut belum terdaftar di master. Tambahkan terlebih dahulu sebelum menyimpan pengiriman.</p>
                <div className="mt-3 space-y-3">
                  {missingItems.length > 0 && (
                    <div>
                      <p className="mb-1.5 text-xs font-semibold text-amber-700">Nama Barang ({missingItems.length})</p>
                      <div className="flex flex-wrap gap-1.5">
                        {missingItems.map((nm) => (
                          <span key={nm} className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-white px-2.5 py-1 text-xs">
                            <span className="max-w-[160px] truncate">{nm}</span>
                            {canItemAdd ? (
                              <button type="button" onClick={() => { setAddName(nm); setAddType("item"); }} className="inline-flex items-center gap-0.5 rounded bg-indigo-600 px-1.5 py-0.5 text-[11px] font-semibold text-white transition hover:bg-indigo-700"><Plus className="h-3 w-3" />Tambah</button>
                            ) : (
                              <span className="text-[11px] font-medium text-rose-500">hubungi admin</span>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {missingOutlets.length > 0 && (
                    <div>
                      <p className="mb-1.5 text-xs font-semibold text-amber-700">Outlet Tujuan ({missingOutlets.length}) — otomatis disinkronkan saat simpan</p>
                      <div className="flex flex-wrap gap-1.5">
                        {missingOutlets.map((nm) => (
                          <span key={nm} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs">
                            <span className="max-w-[160px] truncate">{nm}</span>
                            <span className="text-[10px] font-medium text-emerald-600">otomatis</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {missingWarehouses.length > 0 && (
                    <div>
                      <p className="mb-1.5 text-xs font-semibold text-amber-700">Gudang Asal ({missingWarehouses.length})</p>
                      <div className="flex flex-wrap gap-1.5">
                        {missingWarehouses.map((nm) => (
                          <span key={nm} className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-white px-2.5 py-1 text-xs">
                            <span className="max-w-[160px] truncate">{nm}</span>
                            {canWarehouseAdd ? (
                              <button type="button" onClick={() => { setAddName(nm); setAddType("warehouse"); }} className="inline-flex items-center gap-0.5 rounded bg-indigo-600 px-1.5 py-0.5 text-[11px] font-semibold text-white transition hover:bg-indigo-700"><Plus className="h-3 w-3" />Tambah</button>
                            ) : (
                              <span className="text-[11px] font-medium text-rose-500">hubungi admin</span>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
            {hasDuplicates && (
              <div className="rounded-xl border border-red-300 bg-red-50 p-4">
                <div className="flex items-center gap-2 text-red-700">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <p className="text-sm font-semibold">Nomor DO Duplikat Ditemukan</p>
                </div>
                <p className="mt-1 text-xs text-red-600">Nomor DO berikut sudah ada di database atau muncul lebih dari sekali. Data tidak dapat disimpan untuk menghindari duplikasi.</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {duplicateDos.map((nm) => (
                    <span key={nm} className="inline-flex items-center rounded-lg border border-red-200 bg-white px-2.5 py-1 text-xs font-semibold text-red-600">{nm}</span>
                  ))}
                </div>
              </div>
            )}
            {rows.map((r, idx) => (
              <div key={r._rid} className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{r.outlet_name || "(tanpa nama)"}</p>
                    <p className="text-xs text-slate-500">{r.do_number ? `${r.do_number} · ` : ""}{r.delivery_date || "Tanpa tanggal"} · {r.do_items.length} item · {r.warehouse || "-"}</p>
                  </div>
                  <button type="button" onClick={() => setPendingDelete(idx)} disabled={saving} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
                {r.do_items.length > 0 && (
                  <div className="mt-2 max-h-40 overflow-y-auto rounded-lg bg-slate-50 p-2">
                    {r.do_items.map((it, i) => (
                      <div key={i} className="flex justify-between gap-2 py-0.5 text-xs">
                        <div className="min-w-0">
                          <span className="text-slate-600">{it.name}</span>
                          {it.code && <span className="ml-1 text-slate-400">· {it.code}</span>}
                        </div>
                        <div className="shrink-0 text-right whitespace-nowrap">
                          <span className="font-semibold text-slate-700">{it.quantity} {it.unit}</span>
                          <span className="ml-1 text-slate-500">· {fmtTon(calcTonnage([it]))} kg</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <label className="text-xs font-medium text-slate-600">Gudang Asal<div className="mt-1.5"><WarehouseSelect value={r.warehouse} onChange={(v) => update(idx, "warehouse", v)} className="w-full" /></div></label>
                  <label className="text-xs font-medium text-slate-600">Armada
                    <Select value={r.fleet || "__none__"} onValueChange={(v) => update(idx, "fleet", v === "__none__" ? "" : v)}>
                      <SelectTrigger className="mt-1.5 h-[42px] w-full"><SelectValue placeholder="Pilih armada (opsional)" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— Tidak ada —</SelectItem>
                        {sortedFleets.map((f) => <SelectItem key={f.id} value={f.name}>{f.name}{f.plate ? ` (${f.plate})` : ""}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </label>
                  <label className="text-xs font-medium text-slate-600">Tonase (kg)<div className="mt-1.5 flex gap-1"><input type="number" min="0" step="0.01" inputMode="decimal" value={r.tonnage} onChange={(e) => update(idx, "tonnage", e.target.value)} placeholder="0" className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" /><button type="button" onClick={() => update(idx, "tonnage", Math.round(calcTonnage(r.do_items) * 100) / 100)} className="shrink-0 rounded-xl border border-indigo-200 bg-indigo-50 px-2 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100" title="Hitung dari gramasi"><Calculator className="h-3.5 w-3.5" /></button></div><span className="mt-1 block text-[11px] font-medium text-slate-500">{Number(r.tonnage) ? `${fmtTon(r.tonnage)} kg` : "—"}</span></label>
                </div>
              </div>
            ))}
          </div>

          {rows.length > 0 && (
            <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-indigo-700">Total Tonase Seluruh Impor</span>
                <span className="text-lg font-bold text-indigo-700">{fmtTon(grandTotalTonnage)} kg</span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={onClose} disabled={saving}>Batal</Button>
            <Button onClick={submit} disabled={saving || !rows.length || hasMissing || hasDuplicates} className="bg-indigo-600 text-white hover:bg-indigo-700">{saving ? "Menyimpan..." : hasMissing ? "Lengkapi master data dulu" : hasDuplicates ? "Perbaiki nomor DO duplikat" : `Simpan ${rows.length} Pengiriman`}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={pendingDelete !== null} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus data pengiriman ini?</AlertDialogTitle>
            <AlertDialogDescription>Anda yakin ingin menghapus? Data ini akan dihapus dari daftar impor dan tidak akan disimpan.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">Ya, Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <QuickAddMasterDialog open={!!addType} type={addType} presetName={addName} onClose={() => { setAddType(null); setAddName(""); }} />
    </>
  );
}
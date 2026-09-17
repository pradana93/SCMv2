import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Upload, ChevronDown, ChevronUp, Search, ScanLine, RefreshCw, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import ShipmentList from "@/components/shipping/ShipmentList";
import DateRangeBar from "@/components/shipping/DateRangeBar";
import WarehouseMultiSelect from "@/components/shipping/WarehouseMultiSelect";
import ImportPanel from "@/components/shipping/ImportPanel";
import StockScanDialog from "@/components/shipping/StockScanDialog";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import ShipmentModal from "@/components/shipping/ShipmentModal";
import { useShipmentMutations } from "@/components/shipping/useShipmentMutations";
import { useWarehouseFilter } from "@/components/shipping/WarehouseFilterContext";
import { useShipmentsDateFilter } from "@/components/shipping/DateFilterContext";
import { useAuth } from "@/lib/AuthContext";
import { isSuperAdmin, canEditMaster, statusMeta } from "@/components/shipping/shippingUtils";
import { usePermissions } from "@/components/shipping/usePermissions";
import { STEPS } from "@/components/shipping/processFlowConfig";
import { parseDeliveryReport } from "@/components/shipping/parseDeliveryReport";
import ImportReviewDialog from "@/components/shipping/ImportReviewDialog";
import BulkPackingUploadDialog from "@/components/shipping/BulkPackingUploadDialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PullToRefresh from "@/components/shipping/PullToRefresh";
import { ensureOutlet } from "@/components/shipping/ensureOutlet";
import { generateShipmentBarcodes } from "@/components/shipping/shipmentBarcodeUtils";
import { usePlgenSync } from "@/components/shipping/usePlgenSync";
import { isPlgenSyncConfigured } from "@/api/functions/plgenSync";

export default function Shipments() {
  const { dateFrom, setDateFrom, dateTo, setDateTo } = useShipmentsDateFilter();
  const { user } = useAuth();
  const { can, canDelete: canDeletePerm } = usePermissions();
  const canDelete = canDeletePerm("pengiriman.delete");
  const canEditStatus = can("pengiriman.edit_status");
  const isSuper = isSuperAdmin(user);
  const canReset = canEditMaster(user);
  const { warehouses, setWarehouses, warehouse, queryFilter } = useWarehouseFilter();
  const queryClient = useQueryClient();
  const { data = [], isLoading } = useQuery({
    queryKey: ["shipments", dateFrom, dateTo, warehouses],
    queryFn: () => base44.entities.Shipment.filter({ delivery_date: { $gte: dateFrom, $lte: dateTo }, ...queryFilter }, "-created_date")
  });

  useEffect(() => {
    const unsubscribe = base44.entities.Shipment.subscribe(() => {
      queryClient.invalidateQueries({ queryKey: ["shipments", dateFrom, dateTo, warehouses] });
    });
    return unsubscribe;
  }, [queryClient, dateFrom, dateTo, warehouses]);
  const { updateStatus, deliverShipment, deleteShipment, deleteShipments } = useShipmentMutations();
  const { syncNow, syncing } = usePlgenSync();
  const [syncMsg, setSyncMsg] = useState("");
  const syncTimer = useRef(null);
  const flashSyncMsg = (msg) => {
    setSyncMsg(msg);
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => setSyncMsg(""), 6000);
  };
  useEffect(() => () => { if (syncTimer.current) clearTimeout(syncTimer.current); }, []);
  const handlePlgenSync = async () => {
    flashSyncMsg("Mengambil data PL terbaru dari PLGen...");
    const res = await syncNow();
    if (!res) return;
    if (res.error) flashSyncMsg(res.error);
    else {
      const n = (res.created || []).length;
      flashSyncMsg(n > 0 ? `${n} pengiriman baru ditambahkan dari PLGen.` : "Sudah up-to-date. Tidak ada PL baru dari PLGen.");
    }
  };
  const [showImport, setShowImport] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [prefill, setPrefill] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [bulkPackingOpen, setBulkPackingOpen] = useState(false);
  const [reviewDos, setReviewDos] = useState([]);
  const [scanOpen, setScanOpen] = useState(false);

  const filtered = (data || []).filter((s) => {
    if (statusFilter && s.status !== statusFilter) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (s.outlet_name || "").toLowerCase().includes(q) || (s.fleet || "").toLowerCase().includes(q);
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["shipments"] });
  const create = async (data) => { await base44.entities.Shipment.create(generateShipmentBarcodes(data)); ensureOutlet(data.outlet_name); refresh(); };
  const importDo = async (fileOrDos, isPdfParsed = false) => {
    let dos;
    if (isPdfParsed) {
      dos = fileOrDos;
    } else {
      dos = await parseDeliveryReport(fileOrDos);
    }
    if (!dos || !dos.length) throw new Error("Format file tidak dikenali. Pastikan file merupakan Rincian Pengiriman Pesanan atau Rincian Pemindahan Barang.");
    setReviewDos(dos);
    setReviewOpen(true);
    setShowImport(false);
    return dos;
  };
  const submitReview = async (list) => {
    await base44.entities.Shipment.bulkCreate(list.map(generateShipmentBarcodes));
    [...new Set((list || []).map((d) => (d.outlet_name || "").trim()).filter(Boolean))].forEach((n) => ensureOutlet(n));
    const dates = (list || []).map((d) => d.delivery_date).filter(Boolean).sort();
    if (dates.length) {
      if (dates[0] < dateFrom) setDateFrom(dates[0]);
      if (dates[dates.length - 1] > dateTo) setDateTo(dates[dates.length - 1]);
    }
    refresh();
    setReviewOpen(false);
    setReviewDos([]);
  };

  const handleRefresh = async () => { await queryClient.invalidateQueries({ queryKey: ["shipments"] }); };
  return <PullToRefresh onRefresh={handleRefresh}>
  <div>
    <div className="mb-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Daftar Pengiriman</h1>
          <p className="mt-1 text-sm text-slate-500">Pilih tanggal dan gudang untuk mengelola pengiriman.</p>
        </div>
        <button onClick={() => setScanOpen(true)} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700">
          <ScanLine className="h-4 w-4" /><span className="hidden sm:inline">Scan Barcode</span><span className="sm:hidden">Scan</span>
        </button>
      </div>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <WarehouseMultiSelect value={warehouses} onChange={setWarehouses} className="w-full sm:w-[200px]" />
        <DateRangeBar dateFrom={dateFrom} dateTo={dateTo} onFromChange={setDateFrom} onToChange={setDateTo} />
        <Select value={statusFilter || "all"} onValueChange={(v) => setStatusFilter(v === "all" ? "" : v)}>
          <SelectTrigger className="w-full rounded-xl border-slate-200 sm:w-[180px]"><SelectValue placeholder="Semua Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Status</SelectItem>
            {STEPS.map((s) => <SelectItem key={s} value={s}>{statusMeta[s]?.label || s}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="relative w-full sm:w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari outlet / armada..." className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" />
        </div>
      </div>
    </div>

    <div className="mb-6 flex flex-wrap items-center gap-3">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"><Plus className="h-4 w-4" />Tambah Pengiriman<ChevronDown className="h-4 w-4" /></button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuItem onClick={() => setModalOpen(true)} className="gap-2"><Plus className="h-4 w-4" />Tambah Manual</DropdownMenuItem>
          <DropdownMenuItem onClick={() => setShowImport(true)} className="gap-2"><Upload className="h-4 w-4" />Import Data</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {can("pengiriman.upload_multi_packing") && <button onClick={() => setBulkPackingOpen(true)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"><Upload className="h-4 w-4" />Upload Multi Packing List</button>}
      {isPlgenSyncConfigured && <button onClick={handlePlgenSync} disabled={syncing} title="Ambil PL terbaru dari PLGen sebagai pengiriman baru" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60">{syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}{syncing ? "Syncing..." : "Sync PLGen"}</button>}
      {syncMsg && <p className="w-full text-sm text-slate-500">{syncMsg}</p>}
    </div>

    {showImport && <div className="mb-6"><ImportPanel onImport={importDo} /></div>}

    <ShipmentList shipments={filtered} loading={isLoading} onUpdate={updateStatus} onDeliver={deliverShipment} onDelete={deleteShipment} onDeleteMany={deleteShipments} canDelete={canDelete} canReset={canReset} isSuper={isSuper} canEditStatus={canEditStatus} />

    <ShipmentModal open={modalOpen} onClose={() => { setModalOpen(false); setPrefill(null); }} onSubmit={create} defaultWarehouse={warehouse} prefill={prefill} />
    <ImportReviewDialog open={reviewOpen} dos={reviewDos} defaultWarehouse={warehouse} user={user} onClose={() => setReviewOpen(false)} onSubmit={submitReview} />
    <BulkPackingUploadDialog open={bulkPackingOpen} onClose={() => setBulkPackingOpen(false)} />
    <StockScanDialog open={scanOpen} onClose={() => setScanOpen(false)} />
  </div>
  </PullToRefresh>;
}
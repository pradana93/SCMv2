import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import WarehouseMultiSelect from "@/components/shipping/WarehouseMultiSelect";
import { useWarehouseFilter } from "@/components/shipping/WarehouseFilterContext";
import ReportByStatus from "@/components/shipping/reports/ReportByStatus";
import ReportItemTotal from "@/components/shipping/reports/ReportItemTotal";
import ReportComplaint from "@/components/shipping/reports/ReportComplaint";
import ReportChecker from "@/components/shipping/reports/ReportChecker";
import ReportReschedule from "@/components/shipping/reports/ReportReschedule";
import ReportOtd from "@/components/shipping/reports/ReportOtd";
import ReportFullDetail from "@/components/shipping/reports/ReportFullDetail";
import ReportStock from "@/components/shipping/reports/ReportStock";
import ReportProduksi from "@/components/shipping/reports/ReportProduksi";
import ReportTrenHarian from "@/components/shipping/reports/ReportTrenHarian";
import ReportPenerimaan from "@/components/shipping/reports/ReportPenerimaan";
import ReportSupplierPerformance from "@/components/shipping/reports/ReportSupplierPerformance";
import ReportProductivity from "@/components/shipping/reports/ReportProductivity";
import ReportTonase from "@/components/shipping/reports/ReportTonase";
import ReportMasterData from "@/components/shipping/reports/ReportMasterData";
import ReportItemShipment from "@/components/shipping/reports/ReportItemShipment";
import { usePermissions } from "@/components/shipping/usePermissions";
import { useAuth } from "@/lib/AuthContext";
import { isSuperAdmin } from "@/components/shipping/shippingUtils";

const REPORTS = [
  { value: "by_status", label: "Daftar Pengiriman" },
  { value: "item_total", label: "Total Kuantitas per Barang" },
  { value: "complaint", label: "Rekap Akurasi DO" },
  { value: "checker", label: "Ranking Checker (Tonase & DO)" },
  { value: "reschedule", label: "Pengiriman Reschedule" },
  { value: "otd", label: "Detail On Time Delivery" },
  { value: "full_detail", label: "Detail Lengkap Pengiriman" },
  { value: "produksi", label: "Laporan Produksi" },
  { value: "stock", label: "Laporan Mutasi Stock" },
  { value: "tren_harian", label: "Tren Pengiriman Harian" },
  { value: "penerimaan", label: "Rekap Penerimaan Barang" },
  { value: "supplier_performance", label: "Supplier Performance" },
  { value: "productivity", label: "Laporan Productivity" },
  { value: "tonase", label: "Total Tonase Pengiriman" },
  { value: "item_transfer", label: "Rincian Pengiriman Barang" },
  { value: "master_data", label: "Download Master Data", adminOnly: true },
];

export default function Report() {
  const [reportType, setReportType] = useState("");
  const [range, setRange] = useState({ start: "", end: "" });
  const [status, setStatus] = useState("all");
  const { can } = usePermissions();
  const { user } = useAuth();
  const canMasterData = isSuperAdmin(user) || user?.role === "admin";
  const { warehouses, setWarehouses, isAll } = useWarehouseFilter();

  const { data: shipments = [], isLoading } = useQuery({
    queryKey: ["shipments", "report", range.start, range.end],
    enabled: !!(range.start && range.end),
    queryFn: async () => {
      const all = await base44.entities.Shipment.list("-delivery_date", 500);
      return all.filter((item) => item.delivery_date >= range.start && item.delivery_date <= range.end);
    },
  });
  const { data: productions = [] } = useQuery({ queryKey: ["productions"], queryFn: () => base44.entities.Production.list("-plan_date", 500), enabled: reportType === "produksi" });
  const { data: prodRequests = [] } = useQuery({ queryKey: ["productionRequests"], queryFn: () => base44.entities.ProductionRequest.list("-request_date", 500), enabled: reportType === "produksi" });
  const { data: prodProcesses = [] } = useQuery({ queryKey: ["productionProcesses"], queryFn: () => base44.entities.ProductionProcess.list("-created_date", 500), enabled: reportType === "produksi" });
  const prodFiltered = isAll ? productions : productions.filter((p) => warehouses.includes(p.warehouse));
  const receiptEnabled = reportType === "penerimaan" || reportType === "supplier_performance";
  const { data: receiptsData = [] } = useQuery({ queryKey: ["receipts", "report", range.start, range.end, warehouses], enabled: receiptEnabled && !!(range.start && range.end), queryFn: async () => { const all = await base44.entities.Receipt.list("-arrival_date", 500); return all.filter((r) => r.arrival_date >= range.start && r.arrival_date <= range.end && (isAll || warehouses.includes(r.warehouse))); } });
  const { data: receiptProcessesData = [] } = useQuery({ queryKey: ["receiptProcesses", "report"], queryFn: () => base44.entities.ReceiptProcess.list("-created_date", 500), enabled: receiptEnabled });
  const { data: receiptVerificationsData = [] } = useQuery({ queryKey: ["receiptVerifications", "report"], queryFn: () => base44.entities.ReceiptVerification.list("-created_date", 500), enabled: reportType === "supplier_performance" });

  const wf = isAll ? shipments : shipments.filter((s) => warehouses.includes(s.warehouse));
  const change = (e) => setRange({ ...range, [e.target.name]: e.target.value });
  const inputClass = "mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";
  const showStatus = reportType === "by_status" || reportType === "item_total" || reportType === "full_detail";

  return <div>
    <div className="mb-7"><p className="text-sm font-semibold text-indigo-600">Laporan</p><h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Report Pengiriman</h1><p className="mt-2 text-sm text-slate-500">Pilih jenis laporan, rentang tanggal, dan gudang untuk menampilkan data.</p></div>

    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-sm font-medium">Jenis Report<select value={reportType} onChange={(e) => setReportType(e.target.value)} className={inputClass}><option value="" disabled>Pilih jenis report</option>{REPORTS.filter((r) => {
  if (r.value === "stock" && !can("page.stock")) return false;
  if (r.adminOnly && !canMasterData) return false;
  return true;
}).map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}</select></label>
        {reportType !== "master_data" && <label className="text-sm font-medium">Tanggal Mulai<div className="relative mt-1.5">{!range.start && <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-slate-400">Pilih tanggal</span>}<input type="date" name="start" value={range.start} onChange={change} className={`${inputClass} ${!range.start ? "text-transparent" : ""}`} /></div></label>}
        {reportType !== "master_data" && <label className="text-sm font-medium">Tanggal Akhir<div className="relative mt-1.5">{!range.end && <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-slate-400">Pilih tanggal</span>}<input type="date" name="end" min={range.start || undefined} value={range.end} onChange={change} className={`${inputClass} ${!range.end ? "text-transparent" : ""}`} /></div></label>}
        {reportType !== "master_data" && <label className="text-sm font-medium">Gudang<div className="mt-1.5"><WarehouseMultiSelect value={warehouses} onChange={setWarehouses} className="w-full" /></div></label>}
        {reportType !== "master_data" && showStatus && <label className="text-sm font-medium">Status Pengiriman<select value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass}><option value="all">Semua Status</option><option value="menunggu_antrian">Menunggu Antrian</option><option value="dalam_proses">Dalam Proses</option><option value="sudah_dikirim">Sudah Dikirim</option></select></label>}
      </div>
    </section>

    <div className="mt-6">
      {!reportType || (reportType !== "master_data" && (!range.start || !range.end)) ? <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center"><p className="text-sm text-slate-500">Pilih jenis report dan rentang tanggal untuk menampilkan data.</p></div> :
      (isLoading && reportType !== "penerimaan" && reportType !== "tren_harian" && reportType !== "supplier_performance" && reportType !== "master_data") ? <div className="flex justify-center py-16"><div className="h-7 w-7 animate-spin rounded-full border-4 border-indigo-100 border-t-indigo-600" /></div> :
        reportType === "item_transfer" ? <ReportItemShipment shipments={wf} dateFrom={range.start} dateTo={range.end} /> :
        reportType === "master_data" ? <ReportMasterData /> :
        reportType === "by_status" ? <ReportByStatus shipments={wf} status={status} /> :
        reportType === "item_total" ? <ReportItemTotal shipments={wf} status={status} dateFrom={range.start} dateTo={range.end} /> :
        reportType === "complaint" ? <ReportComplaint shipments={wf} /> :
        reportType === "reschedule" ? <ReportReschedule shipments={wf} /> :
        reportType === "otd" ? <ReportOtd shipments={wf} /> :
        reportType === "full_detail" ? <ReportFullDetail shipments={wf} status={status} /> :
        reportType === "produksi" ? <ReportProduksi productions={prodFiltered} processes={prodProcesses} requests={prodRequests} dateFrom={range.start} dateTo={range.end} /> :
        reportType === "stock" ? <ReportStock shipments={wf} warehouses={warehouses} dateFrom={range.start} dateTo={range.end} /> :
        reportType === "tren_harian" ? <ReportTrenHarian dateFrom={range.start} dateTo={range.end} warehouses={warehouses} /> :
        reportType === "penerimaan" ? <ReportPenerimaan receipts={receiptsData} processes={receiptProcessesData} dateFrom={range.start} dateTo={range.end} /> :
        reportType === "supplier_performance" ? <ReportSupplierPerformance receipts={receiptsData} processes={receiptProcessesData} verifications={receiptVerificationsData} dateFrom={range.start} dateTo={range.end} /> :
        reportType === "productivity" ? <ReportProductivity shipments={wf} /> :
        reportType === "tonase" ? <ReportTonase shipments={wf} dateFrom={range.start} dateTo={range.end} /> :
        <ReportChecker shipments={wf} />}
    </div>
  </div>;
}
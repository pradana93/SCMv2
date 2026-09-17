import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Boxes, CircleCheck, Clock3, LoaderCircle, Target, Timer, Package, ScanLine } from "lucide-react";
import { base44 } from "@/api/base44Client";
import DateRangeBar from "@/components/shipping/DateRangeBar";
import WarehouseMultiSelect from "@/components/shipping/WarehouseMultiSelect";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import KomplainListDialog from "@/components/shipping/KomplainListDialog";
import ShipmentListDialog from "@/components/shipping/ShipmentListDialog";
import OtdListDialog from "@/components/shipping/OtdListDialog";
import StockScanDialog from "@/components/shipping/StockScanDialog";
import { formatTonnage, ALL_WAREHOUSES } from "@/components/shipping/shippingUtils";
import ProductionReviewCard from "@/components/shipping/ProductionReviewCard";
import ReceivedReviewCard from "@/components/shipping/ReceivedReviewCard";
import DistributionProductivityCard from "@/components/shipping/DistributionProductivityCard";
import StockSummaryCard from "@/components/shipping/StockSummaryCard";
import ProductionInProgressCard from "@/components/shipping/ProductionInProgressCard";
import { useOutletEtaMap, computeEstimatedArrival } from "@/components/shipping/etaUtils";
import PullToRefresh from "@/components/shipping/PullToRefresh";
import { useAuth } from "@/lib/AuthContext";
import { useUserWarehouses } from "@/components/shipping/useUserWarehouses";

const todayStr = () => new Date().toISOString().slice(0, 10);
const wf = (warehouses) => (!warehouses || warehouses.length === 0) ? {} : { warehouse: { $in: warehouses } };

export default function Dashboard() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { userWarehouses, hasAll } = useUserWarehouses();
  const canNotify = ["supervisor", "admin", "super_admin"].includes(user?.role);
  const [showKomplain, setShowKomplain] = useState(false);
  const [listView, setListView] = useState(null);
  const [otdView, setOtdView] = useState(null);
  const [stockWh, setStockWh] = useState(hasAll ? [] : userWarehouses);
  const [scanOpen, setScanOpen] = useState(false);
  useEffect(() => { if (!hasAll && userWarehouses.length) setStockWh(userWarehouses); }, [hasAll, userWarehouses]);

  // Card 1: Delivery Monitoring
  const [dmWh, setDmWh] = useState(hasAll ? [] : userWarehouses);
  useEffect(() => { if (!hasAll && userWarehouses.length) setDmWh(userWarehouses); }, [hasAll, userWarehouses]);
  const [dmFrom, setDmFrom] = useState(todayStr());
  const [dmTo, setDmTo] = useState(todayStr());
  const { data: dmData = [], isLoading: dmLoading } = useQuery({
    queryKey: ["shipments", "dm", dmFrom, dmTo, dmWh],
    queryFn: () => base44.entities.Shipment.filter({ delivery_date: { $gte: dmFrom, $lte: dmTo }, ...wf(dmWh) }, "-created_date"),
  });

  // Accordion 1: Delivery Accuracy
  const [accWh, setAccWh] = useState(hasAll ? [] : userWarehouses);
  useEffect(() => { if (!hasAll && userWarehouses.length) setAccWh(userWarehouses); }, [hasAll, userWarehouses]);
  const [accFrom, setAccFrom] = useState(todayStr());
  const [accTo, setAccTo] = useState(todayStr());
  const { data: accData = [], isLoading: accLoading } = useQuery({
    queryKey: ["shipments", "acc", accFrom, accTo, accWh],
    queryFn: () => base44.entities.Shipment.filter({ delivery_date: { $gte: accFrom, $lte: accTo }, ...wf(accWh) }, "-created_date"),
  });

  // Accordion 2: OTD
  const [otdWh, setOtdWh] = useState(hasAll ? [] : userWarehouses);
  useEffect(() => { if (!hasAll && userWarehouses.length) setOtdWh(userWarehouses); }, [hasAll, userWarehouses]);
  const [otdFrom, setOtdFrom] = useState(todayStr());
  const [otdTo, setOtdTo] = useState(todayStr());
  const { data: otdData = [], isLoading: otdLoading } = useQuery({
    queryKey: ["shipments", "otd-dash", otdFrom, otdTo, otdWh],
    queryFn: () => base44.entities.Shipment.filter({ delivery_date: { $gte: otdFrom, $lte: otdTo }, ...wf(otdWh) }, "-created_date"),
  });

  const etaMap = useOutletEtaMap();

  // Delivery Monitoring stats
  const dmCount = (status) => dmData.filter((item) => item.status === status).length;
  const dmTotalTonnage = dmData.reduce((sum, item) => sum + Number(item.tonnage || 0), 0);
  const dalamProsesStatuses = ["proses_picking", "menunggu_packing", "proses_packing", "menunggu_loading", "proses_loading"];
  const dmDalamProsesList = dmData.filter((item) => dalamProsesStatuses.includes(item.status));

  // Delivery Accuracy stats
  const accSudah = accData.filter((item) => item.status === "sudah_dikirim");
  const accKomplain = accSudah.filter((item) => item.accuracy === "ada_komplain");
  const accTanpa = accSudah.filter((item) => item.accuracy === "tanpa_komplain");
  const accBelum = accSudah.filter((item) => !item.accuracy || item.accuracy === "data_belum_tersedia");
  const deliveryAccuracy = accSudah.length > 0 ? Math.round((accSudah.length - accKomplain.length) / accSudah.length * 1000) / 10 : 0;

  // OTD stats
  const otdDelivered = otdData.filter((item) => item.status === "sudah_dikirim");
  const otdWithActual = otdDelivered.filter((item) => item.actual_arrival_date);
  const onTimeList = otdWithActual.filter((item) => { const est = computeEstimatedArrival(item, etaMap); return est && item.actual_arrival_date <= est; });
  const lateList = otdWithActual.filter((item) => { const est = computeEstimatedArrival(item, etaMap); return est && item.actual_arrival_date > est; });
  const otd = otdWithActual.length > 0 ? Math.round(onTimeList.length / otdWithActual.length * 1000) / 10 : 0;
  const otdConclusion = otdWithActual.length === 0 ? "Belum ada data aktual tiba" : otd >= 90 ? "Sangat Baik" : otd >= 75 ? "Baik" : otd >= 50 ? "Cukup" : "Perlu Perbaikan";

  const tones = {
    indigo: "from-indigo-500 to-indigo-600",
    amber: "from-amber-500 to-amber-600",
    blue: "from-blue-500 to-blue-600",
    emerald: "from-emerald-500 to-emerald-600",
    violet: "from-violet-500 to-violet-600",
  };

  const dmStats = [
    { label: "Total Pengiriman", value: dmData.length, icon: Boxes, tone: "indigo", list: dmData },
    { label: "Menunggu Antrian", value: dmCount("menunggu_antrian"), icon: Clock3, tone: "amber", list: dmData.filter((s) => s.status === "menunggu_antrian") },
    { label: "Dalam Proses", value: dmDalamProsesList.length, icon: LoaderCircle, tone: "blue", rincian: `Picking: ${dmCount("proses_picking")} · Packing: ${dmCount("proses_packing")} · Loading: ${dmCount("proses_loading")}`, list: dmDalamProsesList },
    { label: "Sudah Dikirim", value: dmCount("sudah_dikirim"), icon: CircleCheck, tone: "emerald", list: dmData.filter((s) => s.status === "sudah_dikirim") },
  ];

  const handleRefresh = async () => { await queryClient.invalidateQueries({ queryKey: ["shipments"] }); };

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div>
        <div className="mb-6 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Dashboard Monitoring</h1>
            <p className="mt-1 text-sm text-slate-500">Ringkasan distribusi per rentang tanggal.</p>
          </div>
          <button onClick={() => setScanOpen(true)} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700">
            <ScanLine className="h-4 w-4" /><span className="hidden sm:inline">Scan Barcode</span><span className="sm:hidden">Scan</span>
          </button>
        </div>

        {/* Card 1: Delivery Monitoring */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-base font-bold text-slate-800">Delivery Monitoring</h2>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              <WarehouseMultiSelect value={dmWh} onChange={setDmWh} className="w-full sm:w-[200px]" />
              <DateRangeBar dateFrom={dmFrom} dateTo={dmTo} onFromChange={setDmFrom} onToChange={setDmTo} />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
            {dmStats.map(({ label, value, icon: Icon, tone, rincian, list }) => (
              <button key={label} type="button" onClick={() => !dmLoading && setListView({ title: label, icon: Icon, shipments: list })} className="group overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg hover:border-indigo-300 disabled:opacity-70">
                <div className={`flex items-center gap-2 bg-gradient-to-br ${tones[tone]} px-3 py-2.5 text-white`}>
                  <Icon className="h-4 w-4" /><span className="text-xs font-medium">{label}</span>
                </div>
                <div className="px-3 py-3">
                  <p className="text-2xl font-bold tracking-tight">{dmLoading ? "—" : value}</p>
                  {rincian && !dmLoading && <p className="mt-0.5 text-[10px] font-medium text-slate-500 break-words">{rincian}</p>}
                  {!dmLoading && <p className="mt-0.5 text-[10px] text-slate-400 group-hover:text-indigo-500">Klik untuk lihat daftar</p>}
                </div>
              </button>
            ))}
            <button type="button" onClick={() => !dmLoading && setListView({ title: "Total Tonase", icon: Target, shipments: dmData })} className="group overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg hover:border-indigo-300 disabled:opacity-70">
              <div className={`flex items-center gap-2 bg-gradient-to-br ${tones.violet} px-3 py-2.5 text-white`}>
                <Target className="h-4 w-4" /><span className="text-xs font-medium">Total Tonase</span>
              </div>
              <div className="px-3 py-3">
                <p className="text-2xl font-bold tracking-tight">{dmLoading ? "—" : formatTonnage(dmTotalTonnage)}</p>
                {!dmLoading && <p className="mt-0.5 text-[10px] text-slate-400 group-hover:text-indigo-500">Klik untuk lihat daftar</p>}
              </div>
            </button>
          </div>
        </div>

        {/* Card 1.5: Production In Progress */}
        <ProductionInProgressCard />

        {/* Card 2: Production Review */}
        <ProductionReviewCard />

        {/* Card 3: Received Review */}
        <ReceivedReviewCard />

        {/* Accordion */}
        <div className="mt-4">
          <Accordion type="multiple" defaultValue={["acc-1"]} className="space-y-2">
            {/* Item 1: Delivery Accuracy */}
            <AccordionItem value="acc-1" className="rounded-2xl border border-slate-200 bg-white px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-indigo-600" />
                  <span className="text-base font-bold text-slate-800">Delivery Accuracy</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                  <WarehouseMultiSelect value={accWh} onChange={setAccWh} className="w-full sm:w-[200px]" />
                  <DateRangeBar dateFrom={accFrom} dateTo={accTo} onFromChange={setAccFrom} onToChange={setAccTo} />
                </div>
                <div className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm text-slate-500">Delivery Accuracy</p>
                      <p className="mt-1 text-2xl font-bold text-indigo-600">{accLoading ? "—" : `${deliveryAccuracy}%`}</p>
                      <p className="mt-1 text-xs text-slate-400 break-words">{accLoading || !accSudah.length ? "" : `(Sudah Dikirim ${accSudah.length} − Ada Komplain ${accKomplain.length}) ÷ Sudah Dikirim`}</p>
                    </div>
                    <Target className="h-10 w-10 text-indigo-200 shrink-0" />
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                      <p className="text-xs font-medium text-slate-500">Total Sudah Dikirim</p>
                      <p className="mt-1 text-xl font-bold text-slate-900">{accLoading ? "—" : accSudah.length}</p>
                    </div>
                    <button type="button" onClick={() => !accLoading && setListView({ title: "Tanpa Komplain", icon: CircleCheck, iconColor: "text-emerald-600", shipments: accTanpa })} disabled={accLoading} className="group rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:bg-emerald-100/80 disabled:opacity-70">
                      <p className="text-xs font-medium text-slate-500">Total Tanpa Komplain</p>
                      <p className="mt-1 text-xl font-bold text-emerald-600">{accLoading ? "—" : accTanpa.length}</p>
                      {!accLoading && accTanpa.length > 0 && <p className="mt-0.5 text-xs text-emerald-600 group-hover:underline">Klik untuk lihat daftar</p>}
                    </button>
                    <button type="button" onClick={() => !accLoading && setShowKomplain(true)} disabled={accLoading} className="group rounded-xl border border-rose-200 bg-rose-50/50 p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:bg-rose-100/80 disabled:opacity-70">
                      <p className="text-xs font-medium text-slate-500">Total Ada Komplain</p>
                      <p className="mt-1 text-xl font-bold text-rose-600">{accLoading ? "—" : accKomplain.length}</p>
                      {!accLoading && <p className="mt-0.5 text-xs text-rose-500 group-hover:underline">Klik untuk lihat daftar</p>}
                    </button>
                    <button type="button" onClick={() => !accLoading && setListView({ title: "Data Belum Tersedia", icon: Clock3, iconColor: "text-slate-500", shipments: accBelum })} disabled={accLoading} className="group relative rounded-xl border border-slate-200 bg-white p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:bg-slate-100 disabled:opacity-70">
                      {canNotify && !accLoading && accBelum.length > 0 &&
                        <span className="absolute right-2 top-2 flex h-3 w-3" title={`${accBelum.length} data belum tersedia — segera input data akurasi`}>
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                          <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
                        </span>
                      }
                      <p className="text-xs font-medium text-slate-500">Total Data Belum Tersedia</p>
                      <p className="mt-1 text-xl font-bold text-slate-500">{accLoading ? "—" : accBelum.length}</p>
                      {!accLoading && accBelum.length > 0 && <p className="mt-0.5 text-xs text-slate-500 group-hover:underline">Klik untuk lihat daftar</p>}
                    </button>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Item 2: Ontime Delivery */}
            <AccordionItem value="acc-2" className="rounded-2xl border border-slate-200 bg-white px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <Timer className="h-5 w-5 text-emerald-600" />
                  <span className="text-base font-bold text-slate-800">Ontime Delivery</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                  <WarehouseMultiSelect value={otdWh} onChange={setOtdWh} className="w-full sm:w-[200px]" />
                  <DateRangeBar dateFrom={otdFrom} dateTo={otdTo} onFromChange={setOtdFrom} onToChange={setOtdTo} />
                </div>
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm text-slate-500">On Time Delivery</p>
                      <p className="mt-1 text-2xl font-bold text-emerald-600">{otdLoading ? "—" : `${otd}%`}</p>
                      <p className="mt-1 text-xs text-slate-400 break-words">{otdLoading || !otdWithActual.length ? "" : `${onTimeList.length} tepat waktu · ${lateList.length} terlambat dari ${otdWithActual.length} data aktual`}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <Timer className="ml-auto h-8 w-8 text-emerald-300" />
                      <p className="mt-2 text-xs font-medium text-slate-500">Kesimpulan</p>
                      <p className="mt-0.5 text-sm font-semibold text-emerald-700">{otdLoading ? "—" : otdConclusion}</p>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                      <p className="text-xs font-medium text-slate-500">Total Sudah Dikirim</p>
                      <p className="mt-1 text-xl font-bold text-slate-900">{otdLoading ? "—" : otdDelivered.length}</p>
                    </div>
                    <button type="button" onClick={() => !otdLoading && onTimeList.length > 0 && setOtdView({ title: "Tepat Waktu", icon: CircleCheck, iconColor: "text-emerald-600", shipments: onTimeList })} disabled={otdLoading || onTimeList.length === 0} className="group rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:bg-emerald-100/80 disabled:opacity-70">
                      <p className="text-xs font-medium text-slate-500">Tepat Waktu</p>
                      <p className="mt-1 text-xl font-bold text-emerald-600">{otdLoading ? "—" : onTimeList.length}</p>
                      {!otdLoading && onTimeList.length > 0 && <p className="mt-0.5 text-xs text-emerald-600 group-hover:underline">Klik untuk lihat daftar</p>}
                    </button>
                    <button type="button" onClick={() => !otdLoading && lateList.length > 0 && setOtdView({ title: "Terlambat", icon: Clock3, iconColor: "text-amber-600", shipments: lateList })} disabled={otdLoading || lateList.length === 0} className="group rounded-xl border border-amber-200 bg-amber-50/50 p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:bg-amber-100/80 disabled:opacity-70">
                      <p className="text-xs font-medium text-slate-500">Total Terlambat</p>
                      <p className="mt-1 text-xl font-bold text-amber-600">{otdLoading ? "—" : lateList.length}</p>
                      {!otdLoading && lateList.length > 0 && <p className="mt-0.5 text-xs text-amber-600 group-hover:underline">Klik untuk lihat daftar</p>}
                    </button>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Item 3: Distribution Productivity */}
            <AccordionItem value="acc-3" className="rounded-2xl border border-slate-200 bg-white px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <Boxes className="h-5 w-5 text-slate-600" />
                  <span className="text-base font-bold text-slate-800">Distribution Productivity Review</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <DistributionProductivityCard />
              </AccordionContent>
            </AccordionItem>

            {/* Item 4: Stock Summary */}
            <AccordionItem value="acc-4" className="rounded-2xl border border-slate-200 bg-white px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-slate-600" />
                  <span className="text-base font-bold text-slate-800">Stock Summary</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <StockSummaryCard warehouses={stockWh} setWarehouses={setStockWh} />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>

        <KomplainListDialog open={showKomplain} onClose={() => setShowKomplain(false)} shipments={accData} />
        <ShipmentListDialog open={!!listView} onClose={() => setListView(null)} title={listView?.title} icon={listView?.icon} iconColor={listView?.iconColor} shipments={listView?.shipments || []} />
        <OtdListDialog open={!!otdView} onClose={() => setOtdView(null)} title={otdView?.title} icon={otdView?.icon} iconColor={otdView?.iconColor} shipments={otdView?.shipments || []} etaMap={etaMap} />
        <StockScanDialog open={scanOpen} onClose={() => setScanOpen(false)} />
      </div>
    </PullToRefresh>
  );
}
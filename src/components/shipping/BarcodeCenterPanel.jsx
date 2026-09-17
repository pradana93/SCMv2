import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { usePermissions } from "@/components/shipping/usePermissions";
import { Printer, History, Wand2, Search, CheckCircle2, AlertCircle, Package } from "lucide-react";
import BarcodeLabel from "@/components/shipping/BarcodeLabel";
import ShipmentBarcodeTab from "@/components/shipping/ShipmentBarcodeTab";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";

const genBarcodeValue = (item) => {
  if (item.barcode) return item.barcode;
  if (item.code) return item.code;
  return `WMS${String(item.id || "").slice(-8).replace(/[^a-z0-9]/gi, "").toUpperCase().padStart(6, "0")}`;
};

export default function BarcodeCenterPanel() {
  const { can } = usePermissions();
  const qc = useQueryClient();
  const canManage = can("stock.manage");
  const [tab, setTab] = useState("print");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(new Set());
  const [busy, setBusy] = useState(false);

  const { data: items = [], isLoading } = useQuery({ queryKey: ["stockItems"], queryFn: () => base44.entities.StockItem.list() });
  const { data: scans = [] } = useQuery({ queryKey: ["barcodeScans"], queryFn: () => base44.entities.BarcodeScan.list("-created_date", 200) });

  const itemsWithBarcode = useMemo(() => items.map((it) => ({ ...it, _barcode: genBarcodeValue(it) })), [items]);
  const q = search.trim().toLowerCase();
  const filtered = itemsWithBarcode.filter((it) => !q || (it.name || "").toLowerCase().includes(q) || (it.code || "").toLowerCase().includes(q) || (it._barcode || "").toLowerCase().includes(q));
  const categories = useMemo(() => { const set = new Set(); for (const it of filtered) set.add((it.category || "").trim() || "(Tanpa Kategori)"); return [...set].sort((a, b) => a.localeCompare(b, "id")); }, [filtered]);

  const toggle = (id) => setSelected((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const selectAll = () => setSelected(new Set(filtered.map((f) => f.id)));
  const selectNone = () => setSelected(new Set());

  const printSelected = () => {
    const toPrint = itemsWithBarcode.filter((it) => selected.has(it.id));
    if (!toPrint.length) return;
    const win = window.open("", "_blank", "width=800,height=600");
    const labels = toPrint.map((it) => `
      <div class="label">
        <div class="lbl-name">${(it.name || "").replace(/</g, "&lt;")}</div>
        <svg class="lbl-barcode" id="bc-${it.id}"></svg>
        <div class="lbl-code">${(it.code || it._barcode || "").replace(/</g, "&lt;")}</div>
      </div>`).join("");
    win.document.write(`<!DOCTYPE html><html><head><title>Cetak Label Barcode</title>
      <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
      <style>
        @page { margin: 5mm; }
        body { font-family: Arial, sans-serif; margin: 0; padding: 10px; }
        .labels { display: flex; flex-wrap: wrap; gap: 6px; }
        .label { width: 180px; border: 1px dashed #ccc; padding: 6px; text-align: center; page-break-inside: avoid; }
        .lbl-name { font-size: 11px; font-weight: bold; height: 28px; overflow: hidden; }
        .lbl-code { font-size: 10px; color: #666; margin-top: 2px; }
        .lbl-barcode { width: 100%; height: 50px; }
      </style></head><body>
      <div class="labels">${labels}</div>
      <script>
        window.onload = function() {
          ${toPrint.map((it) => `try { JsBarcode(document.getElementById("bc-${it.id}"), "${(it._barcode || "").replace(/"/g, "")}", {format:"CODE128",width:1.5,height:50,displayValue:false,margin:2}); } catch(e){}`).join("\n")}
          setTimeout(function(){ window.print(); }, 500);
        };
      </script>
      </body></html>`);
    win.document.close();
  };

  const generateAll = async () => {
    setBusy(true);
    try {
      const noBarcode = items.filter((it) => !it.barcode);
      if (!noBarcode.length) return;
      const updates = noBarcode.map((it) => ({ id: it.id, barcode: genBarcodeValue(it) }));
      await base44.entities.StockItem.bulkUpdate(updates);
      qc.invalidateQueries({ queryKey: ["stockItems"] });
    } catch {}
    finally { setBusy(false); }
  };

  const tabs = [
    { key: "print", label: "Cetak Label", icon: Printer },
    { key: "pengiriman", label: "Barcode Pengiriman", icon: Package },
    { key: "history", label: "Riwayat Scan", icon: History },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">Cetak label barcode dan lihat riwayat scan barang masuk/keluar.</p>
        {canManage && tab === "print" && (
          <Button onClick={generateAll} disabled={busy} variant="outline" className="gap-1.5">
            <Wand2 className="h-4 w-4" />{busy ? "Memproses..." : "Generate Barcode Otomatis"}
          </Button>
        )}
      </div>

      <div className="mb-4 inline-flex rounded-xl border border-slate-200 bg-white p-1">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-semibold transition ${tab === t.key ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}>
            <t.icon className="h-3.5 w-3.5" />{t.label}
          </button>
        ))}
      </div>

      {tab === "print" && (
        <>
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nama, kode, atau barcode..." className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-indigo-500" />
            </div>
            <div className="flex gap-2">
              <Button onClick={selectAll} variant="outline" size="sm">Pilih Semua</Button>
              <Button onClick={selectNone} variant="outline" size="sm">Batal Pilih</Button>
              <Button onClick={printSelected} disabled={!selected.size} className="gap-1.5"><Printer className="h-4 w-4" />Cetak ({selected.size})</Button>
            </div>
          </div>
          {isLoading ? <div className="flex justify-center py-16"><div className="h-7 w-7 animate-spin rounded-full border-4 border-indigo-100 border-t-indigo-600" /></div> :
            filtered.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center text-sm text-slate-500">Belum ada barang.</div> :
            <Accordion type="multiple" defaultValue={[...categories]} className="w-full">
              {categories.map((cat) => {
                const catItems = filtered.filter((it) => ((it.category || "").trim() || "(Tanpa Kategori)") === cat);
                return (
                  <AccordionItem key={cat} value={cat}>
                    <AccordionTrigger className="text-sm font-bold text-slate-800">{cat} ({catItems.length})</AccordionTrigger>
                    <AccordionContent>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {catItems.map((it) => (
                          <div key={it.id} className={`rounded-2xl border bg-white p-4 shadow-sm transition ${selected.has(it.id) ? "border-indigo-400 ring-2 ring-indigo-100" : "border-slate-200"}`}>
                  <button onClick={() => toggle(it.id)} className="flex w-full items-start gap-3 text-left">
                    <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${selected.has(it.id) ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300"}`}>
                      {selected.has(it.id) && <CheckCircle2 className="h-3.5 w-3.5" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-slate-800">{it.name}</p>
                      <p className="text-xs text-slate-400">{it.code || "tanpa kode"} · {it.unit || "-"}</p>
                      <div className="mt-2 flex justify-center rounded-lg bg-slate-50 py-2"><BarcodeLabel value={it._barcode} height={40} fontSize={10} /></div>
                    </div>
                  </button>
                          </div>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          }
        </>
      )}

      {tab === "pengiriman" && <ShipmentBarcodeTab />}

      {tab === "history" && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          {scans.length === 0 ? <div className="py-16 text-center text-sm text-slate-500">Belum ada riwayat scan.</div> :
            <div className="divide-y divide-slate-100">
              {scans.map((s) => (
                <div key={s.id} className="flex items-center gap-3 px-4 py-3">
                  {s.match_status === "sesuai" ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <AlertCircle className="h-4 w-4 text-rose-500" />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-700">{s.item_name || s.barcode}</p>
                    <p className="text-xs text-slate-400">{s.barcode} · {s.scan_type} · {s.scanned_by}</p>
                  </div>
                  <div className="text-right">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${s.scan_type === "masuk" ? "bg-emerald-50 text-emerald-600" : s.scan_type === "keluar" ? "bg-rose-50 text-rose-600" : "bg-slate-100 text-slate-500"}`}>{s.scan_type}</span>
                    <p className="mt-0.5 text-[11px] text-slate-400">{s.scanned_at ? new Date(s.scanned_at).toLocaleString("id-ID") : ""}</p>
                  </div>
                </div>
              ))}
            </div>
          }
        </div>
      )}
    </div>
  );
}
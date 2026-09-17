import { formatDeliveryDateLong } from "./packingUtils";
import { statusMeta, formatTimestamp } from "./shippingUtils";
import { generateKoliBarcode } from "./shipmentBarcodeUtils";
import JsBarcode from "jsbarcode";

const esc = (v) => String(v == null ? "" : v).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// Pre-render a CODE128 barcode to an inline SVG string (robust — no CDN/onload/selector timing).
const renderKoliBarcodeSvg = (value) => {
  try {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    JsBarcode(svg, String(value || ""), { format: "CODE128", width: 1.4, height: 48, displayValue: false, margin: 2, fontSize: 0 });
    return svg.outerHTML;
  } catch (e) { return ""; }
};

function statusLabel(item) {
  return (statusMeta[item.status] || statusMeta.menunggu_antrian).label;
}

const BASE_CSS = `
@page { size: A4 portrait; margin: 14mm 14mm 14mm 14mm; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; color: #1e293b; font-size: 11px; background: #fff; }
.sheet { padding: 0; }
.break { page-break-before: always; }
/* Header */
.head { border-bottom: 2px solid #1e293b; padding-bottom: 10px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
.head-left .brand { font-size: 11px; font-weight: 700; color: #475569; letter-spacing: .3px; margin-bottom: 2px; }
.head-left h1 { font-size: 20px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; color: #0f172a; line-height: 1.1; }
.statusbox { text-align: right; border: 1px solid #cbd5e1; border-radius: 6px; padding: 5px 12px; min-width: 120px; white-space: nowrap; }
.slbl { font-size: 9px; text-transform: uppercase; color: #64748b; letter-spacing: .3px; }
.sval { font-size: 13px; font-weight: 700; color: #0f172a; }
/* Info grid */
.info { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 28px; margin-bottom: 14px; }
.info .lbl { color: #64748b; font-size: 9px; text-transform: uppercase; letter-spacing: .3px; margin-bottom: 1px; }
.info .val { font-weight: 700; font-size: 11px; color: #0f172a; }
/* Table */
table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
th { background: #f1f5f9; font-weight: 700; font-size: 10px; text-transform: uppercase; color: #334155; border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; }
td { border: 1px solid #cbd5e1; padding: 5px 8px; font-size: 11px; text-align: left; vertical-align: top; }
.right { text-align: right; }
.center { text-align: center; }
/* Barcode page */
.barcode-page { page-break-before: always; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 60mm; }
.barcode-page .bc-lbl { font-size: 9px; text-transform: uppercase; color: #64748b; letter-spacing: .5px; margin-bottom: 10px; }
/* Signature */
.sign { display: flex; justify-content: space-between; margin-top: 36px; }
.sign .col { width: 180px; text-align: center; font-size: 11px; }
.sign .col .name { margin-top: 6px; font-weight: 600; color: #334155; min-height: 14px; }
.sign .col .line { margin-top: 28px; border-top: 1px solid #475569; padding-top: 4px; font-size: 10px; color: #64748b; }
/* Footer */
.foot { margin-top: 20px; border-top: 1px solid #e2e8f0; padding-top: 8px; font-size: 10px; color: #94a3b8; text-align: center; }
`;

function docHead(title, item) {
  return `<div class="head">
    <div class="head-left">
      <div class="brand">PT Bangor Berkembang Bersama</div>
      <h1>${esc(title)}</h1>
    </div>
    <div class="statusbox">
      <div class="slbl">Status</div>
      <div class="sval">${esc(statusLabel(item))}</div>
    </div>
  </div>`;
}

function docFooter() {
  return `<div class="foot">Dokumen ini dicetak oleh Sistem Bangor Logistics &middot; ${esc(formatTimestamp(new Date().toISOString()))}</div>`;
}

function signatureRow(left, right, leftName = "", rightName = "") {
  return `<div class="sign">
    <div class="col">${esc(left)}<div class="name"></div><div class="line">${esc(leftName)}</div></div>
    <div class="col">${esc(right)}<div class="name"></div><div class="line">${esc(rightName)}</div></div>
  </div>`;
}

// ── DO / IT document ────────────────────────────────────────────────────────
function buildDoHtml(item) {
  const isIT = item.document_type === "item_transfer";
  const title = isIT ? "Item Transfer Detail" : "Delivery Order Detail";
  const items = Array.isArray(item.do_items) ? item.do_items : [];

  const infoHtml = `<div class="info">
    <div><div class="lbl">Number</div><div class="val">${esc(item.do_number || "-")}</div></div>
    <div><div class="lbl">Customer</div><div class="val">${esc(item.outlet_name || "-")}</div></div>
    <div><div class="lbl">Date</div><div class="val">${esc(item.delivery_date || "-")}</div></div>
    <div><div class="lbl">Tonase</div><div class="val">${esc(Number(item.tonnage || 0).toLocaleString("id-ID"))} kg</div></div>
    <div><div class="lbl">Gudang Asal</div><div class="val">${esc(item.warehouse || "-")}</div></div>
    <div><div class="lbl">Armada</div><div class="val">${esc(item.fleet || "-")}</div></div>
    <div><div class="lbl">Plat Nomor</div><div class="val">${esc(item.license_plate || "-")}</div></div>
    <div><div class="lbl">Checker</div><div class="val">${esc(item.checker_name || "-")}</div></div>
  </div>`;

  const rowsHtml = items.length
    ? items.map((it, i) => `<tr>
        <td class="center">${i + 1}</td>
        <td>${esc(it.code || "-")}</td>
        <td>${esc(it.name || "-")}</td>
        <td class="right">${esc(it.quantity)}</td>
        <td>${esc(it.unit || "-")}</td>
        <td class="center">${esc(it.koli || "-")}</td>
      </tr>`).join("")
    : `<tr><td class="center" colspan="6">Tidak ada item</td></tr>`;

  const tableHtml = `<table>
    <thead><tr>
      <th class="center" style="width:32px">No</th>
      <th style="width:110px">Code#</th>
      <th>Item Name</th>
      <th class="right" style="width:72px">Quantity</th>
      <th style="width:55px">Unit</th>
      <th class="center" style="width:50px">Koli</th>
    </tr></thead>
    <tbody>${rowsHtml}</tbody>
  </table>`;

  const barcodeSection = item.do_barcode
    ? `<div class="barcode-page">
        <div class="bc-lbl">Barcode DO</div>
        <svg id="doBarcode"></svg>
      </div>`
    : "";

  const barcodeScript = item.do_barcode
    ? `<script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
       <script>window.onload=function(){if(window.JsBarcode&&document.getElementById('doBarcode')){JsBarcode("#doBarcode",${JSON.stringify(item.do_barcode)},{height:60,fontSize:13,displayValue:true,margin:0})}}</script>`
    : "";

  const body = `<div class="sheet">
    ${docHead(title, item)}
    ${infoHtml}
    ${tableHtml}
    ${signatureRow("Checker", "Driver / Crew", item.checker_name, "")}
    ${docFooter()}
    ${barcodeSection}
  </div>`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>${BASE_CSS}</style></head><body>${body}${barcodeScript}</body></html>`;
}

// ── Packing List document ────────────────────────────────────────────────────
function buildPackingHtml(item, sheets = [], editableRows = []) {
  const title = "Packing List";

  const sheetBlocks = sheets.length
    ? sheets.map((sh, i) => {
        const cols = sh.columns && sh.columns.length ? sh.columns : ["no_koli", "description", "qty", "satuan_gramasi", "total_gramasi", "item_unit", "notes"];
        const COL_LABELS = { no_koli: "No. Koli", description: "Description", qty: "Qty", satuan_gramasi: "Satuan Gramasi", total_gramasi: "Total Gramasi (Gr)", item_unit: "Item Unit", notes: "Notes" };
        const headThs = cols.map((k) => `<th class="${k === "qty" || k === "total_gramasi" ? "right" : ""}">${esc(COL_LABELS[k] || k)}</th>`).join("");
        const bodyTrs = (sh.items || []).map((it) => {
          const tds = cols.map((k) => {
            const v = it[k];
            const txt = k === "total_gramasi" ? Number(v || 0).toLocaleString("id-ID") : (v == null || v === "" ? "-" : esc(String(v)));
            return `<td class="${k === "qty" || k === "total_gramasi" ? "right" : ""}">${txt}</td>`;
          }).join("");
          return `<tr>${tds}</tr>`;
        }).join("") || `<tr><td class="center" colspan="${cols.length}">Tidak ada item</td></tr>`;

        const infoHtml = `<div class="info">
          <div><div class="lbl">Ship To</div><div class="val">${esc(sh.ship_to || "-")}</div></div>
          <div><div class="lbl">Delivery No</div><div class="val">${esc(sh.delivery_no || "-")}</div></div>
          <div><div class="lbl">Ship Via</div><div class="val">${esc(sh.ship_via || "-")}</div></div>
          <div><div class="lbl">Delivery Date</div><div class="val">${esc(sh.delivery_date || "-")}</div></div>
        </div>`;

        return `<div class="sheet${i > 0 ? " break" : ""}">
          ${docHead(title, item)}
          ${infoHtml}
          <table><thead><tr>${headThs}</tr></thead><tbody>${bodyTrs}</tbody></table>
          ${signatureRow("Checker", "Packer")}
          ${docFooter()}
        </div>`;
      }).join("")
    : (() => {
        // fallback: editable rows from DO items
        const headThs = `<th>No. Koli</th><th>Description</th><th class="right">Qty</th><th>Item Unit</th><th>Notes</th>`;
        const bodyTrs = (editableRows && editableRows.length)
          ? editableRows.map((r) => `<tr><td class="center">${esc(r.koli || "-")}</td><td>${esc(r.name || "-")}</td><td class="right">${esc(r.qty)}</td><td>${esc(r.unit || "-")}</td><td>${esc(r.notes || "-")}</td></tr>`).join("")
          : `<tr><td class="center" colspan="5">Tidak ada item</td></tr>`;
        const infoHtml = `<div class="info">
          <div><div class="lbl">Ship To</div><div class="val">${esc(item.outlet_name || "-")}</div></div>
          <div><div class="lbl">Delivery No</div><div class="val">${esc(item.do_number || "-")}</div></div>
          <div><div class="lbl">Ship Via</div><div class="val">${esc(item.fleet || "-")}</div></div>
          <div><div class="lbl">Delivery Date</div><div class="val">${esc(formatDeliveryDateLong(item.delivery_date))}</div></div>
        </div>`;
        return `<div class="sheet">
          ${docHead(title, item)}
          ${infoHtml}
          <table><thead><tr>${headThs}</tr></thead><tbody>${bodyTrs}</tbody></table>
          ${signatureRow("Checker", "Packer")}
          ${docFooter()}
        </div>`;
      })();

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>${BASE_CSS}</style></head><body>${sheetBlocks}</body></html>`;
}

// ── Per-Koli print (4 labels per A4 page) ───────────────────────────────────
// Groups packing list rows by no_koli and prints 4 labels per A4 sheet (2x2).
// Layout per label: Outlet header → No. Koli → ITEMS (2 columns, checkbox per row)
//   → Total Items → Delivered From (warehouse)

// Color palette for outlet header backgrounds — 15 distinct light colors with dark text.
const OUTLET_COLORS = [
  { bg: "#FFD180", text: "#5D4037" },
  { bg: "#C5E1A5", text: "#33691E" },
  { bg: "#90CAF9", text: "#0D47A1" },
  { bg: "#F48FB1", text: "#880E4F" },
  { bg: "#B39DDB", text: "#311B92" },
  { bg: "#80DEEA", text: "#006064" },
  { bg: "#FFAB91", text: "#BF360C" },
  { bg: "#A5D6A7", text: "#1B5E20" },
  { bg: "#81D4FA", text: "#01579B" },
  { bg: "#CE93D8", text: "#4A148C" },
  { bg: "#FFF59D", text: "#F57F17" },
  { bg: "#9FA8DA", text: "#1A237E" },
  { bg: "#FFCCBC", text: "#E64A19" },
  { bg: "#B2DFDB", text: "#004D40" },
  { bg: "#E1BEE7", text: "#6A1B9A" },
];

const hashStr = (s) => {
  let h = 0;
  for (let i = 0; i < (s || "").length; i++) {
    h = ((h << 5) - h) + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
};

// Deterministic color per outlet+date — same outlet same day = same color,
// different outlets same day = different colors (date seed rotates the palette).
const getOutletColor = (outletName, deliveryDate) => {
  const dateSeed = hashStr(deliveryDate || "");
  const nameHash = hashStr(outletName || "");
  const idx = (nameHash + dateSeed) % OUTLET_COLORS.length;
  return OUTLET_COLORS[idx];
};

export function buildKoliPrintHtml(item, sheets = []) {
  // Forward-fill no_koli per sheet: Excel packing lists often use merged cells where the
  // koli number appears only on the first row of a koli; subsequent item rows are blank.
  // Carry the last non-empty no_koli forward so all items in one koli group into one label.
  const allRows = [];
  sheets.forEach((sh) => {
    let lastKoli = "";
    (sh.items || []).forEach((it) => {
      let koli = String(it.no_koli || "").trim();
      if (!koli) koli = lastKoli;
      else lastKoli = koli;
      allRows.push({ ...it, no_koli: koli, _sheet: sh });
    });
  });

  const groups = new Map();
  allRows.forEach((row) => {
    const key = String(row.no_koli || "-");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  });

  const totalKoliCount = groups.size;
  const groupsArray = [...groups.entries()];

  const KOLI_CSS = `
    @page { size: A4 portrait; margin: 5mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; color: #000; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .page { display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; width: 200mm; height: 287mm; gap: 0; }
    .page + .page { page-break-before: always; }
    .label { border: 2px solid #000; display: flex; flex-direction: column; overflow: hidden; }
    .lbl-header { border-bottom: 2px solid #000; padding: 2.5mm 3mm; text-align: center; font-weight: bold; font-size: 13pt; line-height: 1.15; }
    .lbl-sub { border-bottom: 1.5px solid #000; padding: 1.8mm 3mm; text-align: center; font-weight: bold; font-size: 10.5pt; }
    .lbl-body { display: flex; flex: 1; min-height: 0; }
    .lbl-items { flex: 1.3; display: flex; flex-direction: column; border-right: 1.5px solid #000; }
    .lbl-items-hdr { padding: 1.8mm 3mm 1.2mm; font-weight: bold; font-size: 10pt; }
    .lbl-rows { flex: 1; display: flex; flex-direction: column; border-top: 1px solid #000; }
    .lbl-row { display: flex; justify-content: space-between; align-items: center; gap: 2mm; padding: 1.5mm 2.5mm; border-bottom: 1px solid #000; font-size: 9pt; min-height: 7mm; line-height: 1.2; }
    .lbl-row:last-child { border-bottom: 0; }
    .lbl-row .txt { flex: 1; word-break: break-word; }
    .lbl-row .box { width: 4mm; height: 4mm; border: 1.2px solid #000; flex-shrink: 0; }
    .lbl-barcode { flex: 1; display: flex; align-items: center; justify-content: center; padding: 2.5mm; }
    .lbl-barcode .bc-box { border: 1.2px solid #000; border-radius: 2mm; padding: 3mm 2mm; width: 100%; display: flex; flex-direction: column; align-items: center; gap: 2mm; }
    .lbl-barcode svg { width: 100%; max-width: 48mm; height: auto; }
    .lbl-barcode .bc-cap { font-size: 7.5pt; text-align: center; word-break: break-all; font-weight: bold; }
    .lbl-foot { border-top: 2px solid #000; padding: 2mm 3mm; font-size: 9pt; }
    .lbl-foot .frow { display: flex; justify-content: space-between; padding: 0.5mm 0; }
    .lbl-foot .frow .v { font-weight: bold; }
  `;

  const pages = [];
  for (let i = 0; i < groupsArray.length; i += 4) {
    pages.push(groupsArray.slice(i, i + 4));
  }
  if (pages.length === 0) pages.push([]);

  const MIN_ROWS = 5;
  const buildRows = (rows) => {
    const out = rows.map((r) => {
      const name = esc(r.description || "").trim();
      const qty = esc(r.qty ?? "");
      const unit = esc(r.item_unit || "");
      const txt = [name, qty, unit].filter(Boolean).join(" ");
      // Checkbox only appears when there is an item name
      const box = name ? `<span class="box"></span>` : "";
      return `<div class="lbl-row"><span class="txt">${txt}</span>${box}</div>`;
    }).join("");
    const pad = Math.max(0, MIN_ROWS - rows.length);
    const padHtml = Array(pad).fill('<div class="lbl-row"><span class="txt"></span></div>').join("");
    return out + padHtml;
  };

  // Flatten rows into a single column list (matches the image: one ITEMS column)
  const pagesHtml = pages.map((pageGroups) => {
    const labels = pageGroups.map(([koliNum, rows]) => {
      const totalQty = rows.reduce((s, r) => s + Number(r.qty || 0), 0);
      const sh = (rows[0] && rows[0]._sheet) || {};
      const outletName = sh.ship_to || item.outlet_name || "-";
      const warehouse = item.warehouse || "-";
      const bcValue = generateKoliBarcode(item, koliNum);
      const bcSvg = renderKoliBarcodeSvg(bcValue);
      const color = getOutletColor(outletName, item.delivery_date);

      return `<div class="label">
        <div class="lbl-header" style="background:${color.bg};color:${color.text};">To: ${esc(outletName)}</div>
        <div class="lbl-sub">No. Koli: ${esc(koliNum)} / ${totalKoliCount}</div>
        <div class="lbl-body">
          <div class="lbl-items">
            <div class="lbl-items-hdr">ITEMS :</div>
            <div class="lbl-rows">${buildRows(rows)}</div>
          </div>
          <div class="lbl-barcode">
            <div class="bc-box">
              ${bcSvg}
              <div class="bc-cap">${esc(bcValue)}</div>
            </div>
          </div>
        </div>
        <div class="lbl-foot">
          <div class="frow"><span>Total Items:</span><span class="v">${totalQty}</span></div>
          <div class="frow"><span>Delivered From :</span><span class="v">${esc(warehouse)}</span></div>
        </div>
      </div>`;
    }).join("");

    const padded = labels + Array(Math.max(0, 4 - pageGroups.length)).fill('<div class="label" style="border:1.5px solid #000;"></div>').join("");
    return `<div class="page">${padded}</div>`;
  }).join("");

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Label Koli - ${esc(item.do_number || item.outlet_name || "")}</title><style>${KOLI_CSS}</style></head><body>${pagesHtml}</body></html>`;
}

// ── Main export ──────────────────────────────────────────────────────────────
export function buildDocHtml({ title, isPacking, item, sheets = [], editableRows = [], orientation = "portrait" }) {
  if (isPacking) return buildPackingHtml(item, sheets, editableRows);
  return buildDoHtml(item);
}
import * as XLSX from "xlsx";

const extractAfter = (cell, prefix) => {
  if (cell == null) return "";
  const s = String(cell).trim();
  const idx = s.toLowerCase().indexOf(prefix.toLowerCase());
  if (idx === -1) return "";
  return s.slice(idx + prefix.length).replace(/^[\s:]+/, "").trim();
};

// Normalize header labels: lowercase, remove dots, collapse spaces.
const normHeader = (s) => String(s || "").trim().toLowerCase().replace(/\./g, "").replace(/\s+/g, " ");

// Normalize info labels: lowercase, replace newlines with spaces, collapse spaces/colons.
const normLabel = (s) => String(s || "").replace(/\n/g, " ").replace(/[:\s]+/g, " ").trim().toLowerCase();

const normalizeDate = (val) => {
  if (val == null) return "";
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  const s = String(val).trim();
  const m = s.match(/(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  const m2 = s.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (m2) return `${m2[3]}-${m2[2].padStart(2, "0")}-${m2[1].padStart(2, "0")}`;
  return s;
};

const HEADER_MAP = [
  { match: "no koli", key: "no_koli" },
  { match: "nama barang", key: "description" },
  { match: "description", key: "description" },
  { match: "qty", key: "qty" },
  { match: "satuan gramasi", key: "satuan_gramasi" },
  { match: "total gramasi", key: "total_gramasi" },
  { match: "item unit", key: "item_unit" },
  { match: "unit", key: "item_unit" },
  { match: "notes", key: "notes" },
];

const ALL_KEYS = ["no_koli", "description", "qty", "satuan_gramasi", "total_gramasi", "item_unit", "notes"];

const INFO_MAP = [
  { match: "delivery order", key: "delivery_no" },
  { match: "delivery no", key: "delivery_no" },
  { match: "outlet", key: "ship_to" },
  { match: "ship to", key: "ship_to" },
  { match: "ship via", key: "ship_via" },
  { match: "delivery date", key: "delivery_date" },
];

export async function parsePackingListFile(file) {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheets = [];
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    if (!ws) continue;
    const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, blankrows: false });
    if (!aoa.length) continue;

    let headerRow = -1;
    let colMap = {};
    for (let i = 0; i < Math.min(aoa.length, 10); i++) {
      const row = aoa[i] || [];
      const map = {};
      row.forEach((cell, ci) => {
        if (cell == null) return;
        const label = normHeader(cell);
        const found = HEADER_MAP.find((h) => label === normHeader(h.match) || label.startsWith(normHeader(h.match)));
        if (found && map[found.key] == null) map[found.key] = ci;
      });
      if (map.no_koli != null && (map.description != null || map.qty != null)) { headerRow = i; colMap = map; break; }
    }
    if (headerRow === -1) continue;

    const columns = ALL_KEYS.filter((k) => colMap[k] != null);

    const headerInfo = { ship_to: name, delivery_no: "", ship_via: "", delivery_date: "" };
    for (let i = 0; i < headerRow; i++) {
      const row = aoa[i] || [];
      for (let ci = 0; ci < row.length; ci++) {
        const cell = row[ci];
        if (cell == null) continue;
        const s = String(cell);
        // Old format: value in same cell after prefix
        const st = extractAfter(s, "Ship To"); if (st && !headerInfo.ship_to) headerInfo.ship_to = st;
        const dn = extractAfter(s, "Delivery No"); if (dn && !headerInfo.delivery_no) headerInfo.delivery_no = dn;
        const sv = extractAfter(s, "Ship Via"); if (sv && !headerInfo.ship_via) headerInfo.ship_via = sv;
        const dd = extractAfter(s, "Delivery Date"); if (dd && !headerInfo.delivery_date) headerInfo.delivery_date = dd;
        // New format: value in next column
        const label = normLabel(s);
        const found = INFO_MAP.find((h) => label === h.match || label.startsWith(h.match));
        if (found) {
          const val = row[ci + 1];
          if (val != null && String(val).trim() && !headerInfo[found.key]) {
            headerInfo[found.key] = found.key === "delivery_date" ? normalizeDate(val) : String(val).trim();
          }
        }
      }
    }

    const items = [];
    let lastKoli = "";
    for (let i = headerRow + 1; i < aoa.length; i++) {
      const r = aoa[i] || [];
      const desc = colMap.description != null ? r[colMap.description] : null;
      if (desc == null || String(desc).trim() === "") continue;
      // Forward-fill no_koli: Excel packing lists often merge the "No Koli" cell, so only
      // the first row of a koli carries the number. Blank rows inherit the previous koli.
      let noKoli = colMap.no_koli != null && r[colMap.no_koli] != null ? String(r[colMap.no_koli]).trim() : "";
      if (!noKoli) noKoli = lastKoli;
      else lastKoli = noKoli;
      items.push({
        no_koli: noKoli,
        description: String(desc).trim(),
        qty: colMap.qty != null ? Number(r[colMap.qty]) || 0 : 0,
        satuan_gramasi: colMap.satuan_gramasi != null && r[colMap.satuan_gramasi] != null ? String(r[colMap.satuan_gramasi]) : "",
        total_gramasi: colMap.total_gramasi != null ? Number(r[colMap.total_gramasi]) || 0 : 0,
        item_unit: colMap.item_unit != null && r[colMap.item_unit] != null ? String(r[colMap.item_unit]).trim() : "",
        notes: colMap.notes != null && r[colMap.notes] != null ? String(r[colMap.notes]).trim() : "",
      });
    }
    sheets.push({ sheet_name: name, ...headerInfo, columns, items });
  }
  return sheets;
}
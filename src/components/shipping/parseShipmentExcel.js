import * as XLSX from "xlsx";

const FIELD_KEYWORDS = {
  delivery_date: ["tanggal", "tgl", "date", "delivery", "kir"],
  warehouse: ["gudang", "warehouse", "asal"],
  outlet_name: ["outlet", "tujuan", "destination", "toko"],
  tonnage: ["tonase", "tonnage", "ton", "berat", "weight", "kg"],
  fleet: ["armada", "fleet", "kendaraan", "vehicle", "plat", "no"],
};

const normalize = (h) => String(h).toLowerCase().replace(/[^a-z0-9]/g, "");

function matchField(header) {
  const n = normalize(header);
  if (!n) return null;
  for (const [field, keys] of Object.entries(FIELD_KEYWORDS)) {
    if (keys.some((k) => n.includes(normalize(k)))) return field;
  }
  return null;
}

function toDate(val) {
  if (val instanceof Date && !isNaN(val)) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, "0");
    const d = String(val.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  if (typeof val === "number") {
    const dt = new Date(Math.round((val - 25569) * 86400 * 1000));
    const y = dt.getUTCFullYear();
    const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
    const d = String(dt.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const s = String(val).trim();
  let m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (m) {
    let [, d, mo, y] = m;
    if (y.length === 2) y = `20${y}`;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  m = s.match(/^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})$/);
  if (m) {
    let [, y, mo, d] = m;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return s;
}

export async function parseShipmentExcel(file) {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf);
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) return [];
  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: "" });
  if (aoa.length < 2) return [];
  const headers = aoa[0].map(matchField);
  const rows = [];
  for (let i = 1; i < aoa.length; i++) {
    const cells = aoa[i];
    if (!cells || cells.every((c) => c === "" || c == null)) continue;
    const obj = {};
    cells.forEach((c, idx) => {
      const f = headers[idx];
      if (f) obj[f] = c;
    });
    if (!obj.delivery_date && !obj.outlet_name && !obj.tonnage) continue;
    const tonnageRaw = String(obj.tonnage ?? "").replace(/[^\d.-]/g, "");
    rows.push({
      delivery_date: toDate(obj.delivery_date),
      warehouse: String(obj.warehouse || "").trim(),
      outlet_name: String(obj.outlet_name || "").trim(),
      tonnage: Number(tonnageRaw) || 0,
      fleet: String(obj.fleet || "").trim(),
    });
  }
  return rows;
}
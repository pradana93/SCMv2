import * as XLSX from "xlsx";

const MONTHS = {
  januari: 0, februari: 1, maret: 2, april: 3, mei: 4, juni: 5, juli: 6,
  agustus: 7, september: 8, oktober: 9, november: 10, desember: 11,
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5, july: 6,
  august: 7, october: 9, november: 10, december: 11,
};

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
  let m = s.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{2,4})$/);
  if (m) {
    let [, d, mo, y] = m;
    const mon = MONTHS[mo.toLowerCase()];
    if (mon != null) {
      if (y.length === 2) y = `20${y}`;
      return `${y}-${String(mon + 1).padStart(2, "0")}-${d.padStart(2, "0")}`;
    }
  }
  m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
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

const norm = (v) => String(v ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

function findValue(aoa, labelKeys) {
  for (const row of aoa) {
    if (!row) continue;
    for (let i = 0; i < row.length; i++) {
      const n = norm(row[i]);
      if (!n) continue;
      if (labelKeys.some((k) => n === k || n.includes(k))) {
        for (let j = i + 1; j < row.length; j++) {
          const c = row[j];
          if (c == null || c === "") continue;
          if (c === ":") continue;
          return String(c).trim();
        }
      }
    }
  }
  return "";
}

export async function parseDoExcel(file) {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf);
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) return null;
  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });

  const do_number = findValue(aoa, ["number", "nomor", "nodo"]);
  const outlet_name = findValue(aoa, ["customer", "outlet", "tujuan"]);
  const dateRaw = findValue(aoa, ["date", "tanggal", "tgl"]);
  const tonaseRaw = findValue(aoa, ["tonase", "tonnage", "ton"]);

  let headerIdx = -1, codeCol = -1, nameCol = -1, qtyCol = -1, unitCol = -1;
  for (let i = 0; i < aoa.length; i++) {
    const row = aoa[i];
    if (!row) continue;
    for (let j = 0; j < row.length; j++) {
      const n = norm(row[j]);
      if (!n) continue;
      if (codeCol < 0 && (n.includes("code") || n === "kode")) codeCol = j;
      if (nameCol < 0 && (n.includes("item") || n.includes("nama") || n.includes("produk"))) nameCol = j;
      if (qtyCol < 0 && (n.includes("qty") || n.includes("quantity") || n.includes("jumlah"))) qtyCol = j;
      if (unitCol < 0 && (n.includes("unit") || n.includes("satuan"))) unitCol = j;
    }
    if (codeCol >= 0 && qtyCol >= 0) { headerIdx = i; break; }
  }

  const items = [];
  if (headerIdx >= 0) {
    for (let i = headerIdx + 1; i < aoa.length; i++) {
      const row = aoa[i];
      if (!row) continue;
      const code = codeCol >= 0 ? row[codeCol] : null;
      const name = nameCol >= 0 ? row[nameCol] : null;
      const qty = qtyCol >= 0 ? row[qtyCol] : null;
      const unit = unitCol >= 0 ? row[unitCol] : null;
      const hasCode = code != null && String(code).trim() !== "";
      const hasName = name != null && String(name).trim() !== "";
      if (!hasCode && !hasName) continue;
      if (qty == null && !hasCode && !hasName) continue;
      items.push({
        code: String(code ?? "").trim(),
        name: String(name ?? "").trim(),
        quantity: Number(String(qty ?? "").replace(/[^\d.-]/g, "")) || 0,
        unit: String(unit ?? "").trim(),
      });
    }
  }

  return {
    do_number,
    outlet_name,
    delivery_date: toDate(dateRaw),
    tonnage: Number(String(tonaseRaw ?? "").replace(/[^\d.-]/g, "")) || 0,
    do_items: items,
  };
}
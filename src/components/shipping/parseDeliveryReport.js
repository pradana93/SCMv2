import * as XLSX from "xlsx";

const MONTHS = {
  januari: 0, februari: 1, maret: 2, april: 3, mei: 4, juni: 5, juli: 6,
  agustus: 7, september: 8, oktober: 9, november: 10, desember: 11,
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5, july: 6,
  august: 7, october: 9, november: 10, december: 11,
};

const norm = (v) => String(v ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

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
  if (/^\d{4,6}$/.test(s)) {
    const dt = new Date(Math.round((Number(s) - 25569) * 86400 * 1000));
    if (!isNaN(dt)) {
      const y = dt.getUTCFullYear();
      const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
      const d = String(dt.getUTCDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }
  }
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

const isDateStr = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));

function findLabelValue(row, labelKeys) {
  if (!row) return "";
  for (let i = 0; i < row.length; i++) {
    const n = norm(row[i]);
    if (!n) continue;
    if (labelKeys.some((k) => n === k || n.includes(k))) {
      for (let j = i + 1; j < row.length; j++) {
        const c = row[j];
        if (c == null || c === "") continue;
        if (c === ":") continue;
        return typeof c === "number" ? c : String(c).trim();
      }
    }
  }
  return "";
}

const isNomorRow = (row) => (row || []).some((c) => {
  const n = norm(c);
  return n === "nomor" || n === "number" || n === "nomor#" || n === "nopemindahan" || n === "nopemindahan#" || n.includes("nopemindahan") || n.includes("nomor#") || n === "no";
});

const isFooter = (rowNorm) => rowNorm.some((n) => n.includes("accurate") || n.includes("tercetak") || n.includes("halaman"));

// Deteksi jenis dokumen dari judul laporan
function detectType(aoa) {
  for (let i = 0; i < Math.min(aoa.length, 20); i++) {
    for (const c of (aoa[i] || [])) {
      const n = norm(c);
      if (n.includes("pemindahan")) return "item_transfer";
      if (n.includes("pengirimanpesanan")) return "delivery_order";
    }
  }
  return "delivery_order";
}

// Cari rentang tanggal "Dari ... s/d ..." pada sel tunggal
function parseDateRange(aoa) {
  for (const row of aoa) {
    if (!row) continue;
    for (const c of row) {
      if (typeof c !== "string") continue;
      const m = c.match(/dari\s+([0-9]{1,2}\s+[A-Za-z]+\s+[0-9]{2,4})\s*s\/?d/i);
      if (m) return toDate(m[1]);
      const m2 = c.match(/dari\s+(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})\s*s\/?d/i);
      if (m2) return toDate(m2[1]);
    }
  }
  return "";
}

// Parser tabular untuk "Rincian Pemindahan Barang"
// Format: baris header (Tanggal | Nomor | Dari Gudang | Ke Gudang), lalu per pemindahan
// ada baris transfer (berisi tanggal + nomor + gudang) diikuti sub-tabel item.
function parsePemindahanTabular(aoa, dateRange) {
  let headerIdx = -1;
  let tglCol = -1, nomorCol = -1, dariCol = -1, keCol = -1;
  for (let i = 0; i < Math.min(aoa.length, 40); i++) {
    const row = aoa[i] || [];
    const ns = row.map(norm);
    const hasTgl = ns.some((n) => n === "tanggal" || n === "tgl" || n === "date");
    const hasNomor = ns.some((n) => n === "nomor" || n === "nomor#" || n === "number" || n === "no");
    const hasGudang = ns.some((n) => n.includes("gudang") || n.includes("tujuan") || n.includes("asal") || n.includes("dari") || n === "ke");
    if (hasTgl && hasNomor && hasGudang) {
      headerIdx = i;
      for (let j = 0; j < row.length; j++) {
        const n = norm(row[j]);
        if (tglCol < 0 && (n === "tanggal" || n === "tgl" || n === "date")) tglCol = j;
        if (nomorCol < 0 && (n === "nomor" || n === "nomor#" || n === "number" || n === "no")) nomorCol = j;
        if (dariCol < 0 && (n.includes("darigudang") || n.includes("gudangdari") || n.includes("gudangasal") || n.includes("asal") || n === "dari")) dariCol = j;
        if (keCol < 0 && (n.includes("kegudang") || n.includes("gudangtujuan") || n.includes("gudangke") || n.includes("tujuan") || n === "ke")) keCol = j;
      }
      break;
    }
  }
  if (headerIdx < 0) return null;

  const dos = [];
  let cur = null;
  let codeCol = -1, nameCol = -1, qtyCol = -1, unitCol = -1;
  let inItems = false;

  for (let i = headerIdx + 1; i < aoa.length; i++) {
    const row = aoa[i] || [];
    const ns = row.map(norm);
    if (isFooter(ns)) { inItems = false; continue; }

    // deteksi header item (kode + kuantitas)
    const hasCode = ns.some((n) => n.includes("kode") || n.includes("code"));
    const hasQty = ns.some((n) => n.includes("kuantitas") || n.includes("qty") || n.includes("quantity") || n.includes("jumlah"));
    if (hasCode && hasQty) {
      for (let j = 0; j < row.length; j++) {
        const n = ns[j];
        if (!n) continue;
        if (codeCol < 0 && (n.includes("kode") || n.includes("code"))) codeCol = j;
        if (nameCol < 0 && (n.includes("nama") || n.includes("barang") || n.includes("item") || n.includes("produk"))) nameCol = j;
        if (qtyCol < 0 && (n.includes("kuantitas") || n.includes("qty") || n.includes("quantity") || n.includes("jumlah"))) qtyCol = j;
        if (unitCol < 0 && (n.includes("satuan") || n.includes("unit"))) unitCol = j;
      }
      inItems = true;
      continue;
    }

    // deteksi baris pemindahan: ada tanggal valid + nomor
    const tglVal = tglCol >= 0 ? row[tglCol] : row[0];
    const tglStr = toDate(tglVal);
    const nomorVal = nomorCol >= 0 ? row[nomorCol] : null;
    const isTransfer = isDateStr(tglStr) && tglStr !== String(tglVal ?? "").trim() && nomorVal != null && String(nomorVal).trim() !== "";
    if (isTransfer) {
      if (cur) dos.push(cur);
      const dari = dariCol >= 0 ? row[dariCol] : "";
      const ke = keCol >= 0 ? row[keCol] : "";
      const outlet = String(ke || dari || "").trim();
      cur = { do_number: String(nomorVal).trim(), outlet_name: outlet, warehouse: String(dari || "").trim(), delivery_date: tglStr, do_items: [] };
      codeCol = nameCol = qtyCol = unitCol = -1;
      inItems = false;
      continue;
    }

    // baris item
    if (inItems && cur) {
      const code = codeCol >= 0 ? row[codeCol] : null;
      const name = nameCol >= 0 ? row[nameCol] : null;
      const qty = qtyCol >= 0 ? row[qtyCol] : null;
      const unit = unitCol >= 0 ? row[unitCol] : null;
      const hasC = code != null && String(code).trim() !== "";
      const hasN = name != null && String(name).trim() !== "";
      if (!hasC && !hasN) continue;
      cur.do_items.push({
        code: String(code ?? "").trim(),
        name: String(name ?? "").trim(),
        quantity: Number(String(qty ?? "").replace(/[^\d.-]/g, "")) || 0,
        unit: String(unit ?? "").trim(),
      });
    }
  }
  if (cur) dos.push(cur);
  for (const d of dos) if (!d.delivery_date && dateRange) d.delivery_date = dateRange;
  return dos;
}

// Parser label-baris (format "Nomor #: ...", "Pelanggan: ...", "Ke Gudang: ...")
function parseLabeled(aoa, documentType, dateRange) {
  const gudangKeys = documentType === "item_transfer"
    ? ["gudangtujuandari", "kegudang", "gudangtujuan", "gudangke", "tujuan", "darigudang", "gudangdari", "gudangasal", "dari"]
    : ["pelanggan", "customer", "tujuan", "outlet"];
  const warehouseKeys = ["darigudang", "gudangdari", "gudangasal", "asal", "gudang"];

  const dos = [];
  let cur = null;
  let codeCol = -1, nameCol = -1, qtyCol = -1, unitCol = -1;
  let inItems = false;

  for (let i = 0; i < aoa.length; i++) {
    const row = aoa[i];
    if (!row) continue;
    const rowNorm = row.map(norm);

    if (isNomorRow(row)) {
      if (cur) dos.push(cur);
      const do_number = findLabelValue(row, ["nopemindahan", "nomor", "number", "no"]);
      const outlet_name = findLabelValue(row, gudangKeys);
      cur = { do_number: String(do_number || ""), outlet_name: String(outlet_name || ""), warehouse: "", delivery_date: "", do_items: [] };
      codeCol = nameCol = qtyCol = unitCol = -1;
      inItems = false;
      continue;
    }

    if (!cur) {
      const gudang = findLabelValue(row, gudangKeys);
      if (gudang) {
        cur = { do_number: "", outlet_name: String(gudang), delivery_date: "", do_items: [] };
        codeCol = nameCol = qtyCol = unitCol = -1;
        inItems = false;
        continue;
      }
      continue;
    }

    // Tangkap gudang/outlet untuk Pemindahan bila masih kosong (label setelah Nomor)
    if (documentType === "item_transfer" && !cur.outlet_name) {
      const gudang = findLabelValue(row, gudangKeys);
      if (gudang) { cur.outlet_name = String(gudang); continue; }
    }

    // Tangkap gudang asal untuk Pengiriman Pesanan bila masih kosong
    if (documentType === "delivery_order" && !cur.warehouse) {
      const wh = findLabelValue(row, warehouseKeys);
      if (wh) { cur.warehouse = String(wh); continue; }
    }

    if (!cur.delivery_date) {
      const d = findLabelValue(row, ["tanggal", "date", "tgl"]);
      if (d !== "" && d != null) cur.delivery_date = toDate(d);
    }

    if (!inItems) {
      const hasCode = rowNorm.some((n) => n.includes("kode") || n.includes("code"));
      const hasQty = rowNorm.some((n) => n.includes("kuantitas") || n.includes("qty") || n.includes("quantity") || n.includes("jumlah"));
      if (hasCode && hasQty) {
        for (let j = 0; j < row.length; j++) {
          const n = norm(row[j]);
          if (!n) continue;
          if (codeCol < 0 && (n.includes("kode") || n.includes("code"))) codeCol = j;
          if (nameCol < 0 && (n.includes("nama") || n.includes("barang") || n.includes("item") || n.includes("produk"))) nameCol = j;
          if (qtyCol < 0 && (n.includes("kuantitas") || n.includes("qty") || n.includes("quantity") || n.includes("jumlah"))) qtyCol = j;
          if (unitCol < 0 && (n.includes("satuan") || n.includes("unit"))) unitCol = j;
        }
        inItems = true;
        continue;
      }
    }

    if (inItems) {
      if (isFooter(rowNorm)) { inItems = false; continue; }
      const code = codeCol >= 0 ? row[codeCol] : null;
      const name = nameCol >= 0 ? row[nameCol] : null;
      const qty = qtyCol >= 0 ? row[qtyCol] : null;
      const unit = unitCol >= 0 ? row[unitCol] : null;
      const hasCode = code != null && String(code).trim() !== "";
      const hasName = name != null && String(name).trim() !== "";
      if (!hasCode && !hasName) {
        if (qty != null && String(qty).trim() !== "" && !isNaN(Number(String(qty).replace(/[^\d.-]/g, "")))) {
          inItems = false;
        }
        continue;
      }
      cur.do_items.push({
        code: String(code ?? "").trim(),
        name: String(name ?? "").trim(),
        quantity: Number(String(qty ?? "").replace(/[^\d.-]/g, "")) || 0,
        unit: String(unit ?? "").trim(),
      });
    }
  }
  if (cur) dos.push(cur);
  for (const d of dos) if (!d.delivery_date && dateRange) d.delivery_date = dateRange;
  return dos;
}

// Ekstrak "Cabang : ..." dari baris metadata (untuk gudang asal Pengiriman Pesanan)
function parseCabang(aoa) {
  for (const row of aoa) {
    if (!row) continue;
    for (const c of row) {
      if (typeof c !== "string") continue;
      const m = c.match(/cabang\s*:\s*(.+)/i);
      if (m) return m[1].trim();
    }
  }
  return "";
}

// Parser tabular: header row dengan nama kolom, lalu data per baris.
// Delivery Order: dikelompokkan per Nomor # (baris lanjutan tanpa nomor = item DO sebelumnya).
// Item Transfer: setiap baris adalah satu pemindahan dengan satu barang.
function parseTabular(aoa, documentType, dateRange) {
  let headerIdx = -1;
  for (let i = 0; i < Math.min(aoa.length, 30); i++) {
    const ns = (aoa[i] || []).map(norm);
    const hasBarang = ns.some((n) => n.includes("namabarang") || n === "barang");
    const hasQty = ns.some((n) => n.includes("kuantitas") || n.includes("qty") || n.includes("quantity"));
    const hasNomor = ns.some((n) => n.includes("nomor") || n.includes("pemindahan"));
    if (hasBarang && hasQty && hasNomor) { headerIdx = i; break; }
  }
  if (headerIdx < 0) return null;

  const header = aoa[headerIdx] || [];
  const cols = {};
  for (let j = 0; j < header.length; j++) {
    const n = norm(header[j]);
    if (!n) continue;
    if (n.includes("pemindahan") || (n.includes("nomor") && cols.nomor == null)) cols.nomor = j;
    else if (n.includes("kode") && cols.kode == null) cols.kode = j;
    else if ((n === "tanggal" || n === "tgl" || n === "date") && cols.tanggal == null) cols.tanggal = j;
    else if ((n.includes("gudangtujuan") || n.includes("tujuandari") || n.includes("tujuan")) && cols.tujuan == null) cols.tujuan = j;
    else if (n === "gudang" && cols.gudang == null) cols.gudang = j;
    else if ((n.includes("namabarang") || n === "barang") && cols.barang == null) cols.barang = j;
    else if ((n.includes("satuan") || n.includes("unit")) && cols.satuan == null) cols.satuan = j;
    else if ((n.includes("pelanggan") || n.includes("customer")) && cols.pelanggan == null) cols.pelanggan = j;
    else if ((n.includes("kuantitas") || n.includes("qty") || n.includes("quantity")) && cols.kuantitas == null) cols.kuantitas = j;
  }
  if (cols.nomor == null || cols.barang == null) return null;

  const dos = [];
  let cur = null;
  for (let i = headerIdx + 1; i < aoa.length; i++) {
    const row = aoa[i] || [];
    if (isFooter(row.map(norm))) continue;
    const nomorStr = cols.nomor != null ? String(row[cols.nomor] ?? "").trim() : "";
    const itemName = cols.barang != null ? String(row[cols.barang] ?? "").trim() : "";
    const satuanStr = cols.satuan != null ? String(row[cols.satuan] ?? "").trim() : "";
    const qtyNum = Number(String(cols.kuantitas != null ? row[cols.kuantitas] ?? "" : "").replace(/[^\d.-]/g, "")) || 0;
    if (!nomorStr && !itemName && qtyNum === 0) continue;

    if (documentType === "delivery_order") {
      if (nomorStr) {
        if (cur) dos.push(cur);
        cur = {
          do_number: nomorStr,
          outlet_name: cols.pelanggan != null ? String(row[cols.pelanggan] ?? "").trim() : "",
          warehouse: "",
          delivery_date: toDate(cols.tanggal != null ? row[cols.tanggal] : null),
          do_items: [],
        };
      }
      if (cur && itemName) cur.do_items.push({ code: cols.kode != null ? String(row[cols.kode] ?? "").trim() : "", name: itemName, quantity: qtyNum, unit: satuanStr });
    } else {
      if (nomorStr) {
        if (cur) dos.push(cur);
        const dari = cols.gudang != null ? String(row[cols.gudang] ?? "").trim() : "";
        const ke = cols.tujuan != null ? String(row[cols.tujuan] ?? "").trim() : "";
        cur = {
          do_number: nomorStr,
          outlet_name: ke || dari,
          warehouse: dari,
          delivery_date: toDate(cols.tanggal != null ? row[cols.tanggal] : null),
          do_items: [],
        };
      }
      if (cur && itemName) cur.do_items.push({ code: cols.kode != null ? String(row[cols.kode] ?? "").trim() : "", name: itemName, quantity: qtyNum, unit: satuanStr });
    }
  }
  if (cur) dos.push(cur);
  for (const d of dos) if (!d.delivery_date && dateRange) d.delivery_date = dateRange;
  return dos;
}

// Parser tabular "Rincian Pemindahan Barang" tanpa kolom Nomor.
// Format: Tanggal | Gudang | Gudang Tujuan/Dari | Nama Barang | Satuan | Kuantitas
// Setiap ganti "Gudang Tujuan/Dari" = satu pemindahan baru.
function parsePemindahanNoNomor(aoa, dateRange) {
  let headerIdx = -1;
  let tglCol = -1, gudangCol = -1, tujuanCol = -1, barangCol = -1, satuanCol = -1, qtyCol = -1, kodeCol = -1;

  for (let i = 0; i < Math.min(aoa.length, 40); i++) {
    const row = aoa[i] || [];
    const ns = row.map(norm);
    const hasTgl = ns.some((n) => n === "tanggal" || n === "tgl" || n === "date");
    const hasGudang = ns.some((n) => n === "gudang" || n.includes("gudangtujuan") || n.includes("tujuandari"));
    const hasBarang = ns.some((n) => n.includes("namabarang") || n === "barang");
    const hasQty = ns.some((n) => n.includes("kuantitas") || n.includes("qty") || n.includes("quantity"));
    const hasNomor = ns.some((n) => n.includes("nomor") || n.includes("pemindahan") || n === "no");
    if (hasTgl && hasGudang && hasBarang && hasQty && !hasNomor) {
      headerIdx = i;
      for (let j = 0; j < row.length; j++) {
        const n = ns[j];
        if (!n) continue;
        if (tglCol < 0 && (n === "tanggal" || n === "tgl" || n === "date")) tglCol = j;
        if (gudangCol < 0 && n === "gudang") gudangCol = j;
        if (tujuanCol < 0 && (n.includes("gudangtujuan") || n.includes("tujuandari") || n.includes("tujuan") || n === "dari")) tujuanCol = j;
        if (kodeCol < 0 && n.includes("kode")) kodeCol = j;
        if (barangCol < 0 && (n.includes("namabarang") || n === "barang")) barangCol = j;
        if (satuanCol < 0 && (n.includes("satuan") || n.includes("unit"))) satuanCol = j;
        if (qtyCol < 0 && (n.includes("kuantitas") || n.includes("qty") || n.includes("quantity"))) qtyCol = j;
      }
      break;
    }
  }
  if (headerIdx < 0 || tujuanCol < 0 || barangCol < 0) return null;

  const dos = [];
  let cur = null;
  let curDate = "";
  let curGudang = "";

  for (let i = headerIdx + 1; i < aoa.length; i++) {
    const row = aoa[i] || [];
    const ns = row.map(norm);
    if (isFooter(ns)) continue;

    const tglRaw = tglCol >= 0 ? row[tglCol] : null;
    const gudang = gudangCol >= 0 ? String(row[gudangCol] ?? "").trim() : "";
    const tujuan = String(row[tujuanCol] ?? "").trim();
    const barang = String(row[barangCol] ?? "").trim();
    const satuan = satuanCol >= 0 ? String(row[satuanCol] ?? "").trim() : "";
    const qty = qtyCol >= 0 ? Number(String(row[qtyCol] ?? "").replace(/[^\d.-]/g, "")) || 0 : 0;

    if (tglRaw != null && String(tglRaw).trim() !== "") curDate = toDate(tglRaw);
    if (gudang) curGudang = gudang;

    if (tujuan && (!cur || cur.outlet_name !== tujuan)) {
      if (cur) dos.push(cur);
      cur = {
        do_number: "",
        outlet_name: tujuan,
        warehouse: curGudang || "",
        delivery_date: curDate || (dateRange || ""),
        do_items: [],
      };
    }
    if (cur && barang && qty > 0) {
      cur.do_items.push({ code: kodeCol >= 0 ? String(row[kodeCol] ?? "").trim() : "", name: barang, quantity: qty, unit: satuan });
    }
  }
  if (cur) dos.push(cur);
  for (let i = 0; i < dos.length; i++) {
    if (!dos[i].do_number) {
      const dateStr = (dos[i].delivery_date || dateRange || "").replace(/-/g, "");
      dos[i].do_number = `IT${dateStr}${String(i + 1).padStart(3, "0")}`;
    }
  }
  for (const d of dos) if (!d.delivery_date && dateRange) d.delivery_date = dateRange;
  return dos;
}

// Membaca dua format laporan Accurate:
// 1) "Rincian Pengiriman Pesanan" (banyak DO: Nomor #, Pelanggan, Tanggal, item)
// 2) "Rincian Pemindahan Barang" (Nomor/No. Pemindahan, Tanggal, Gudang Tujuan/Dari, item)
// Setiap entry diberi document_type: "delivery_order" | "item_transfer"
export async function parseDeliveryReport(file) {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf);
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) return [];
  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
  const documentType = detectType(aoa);
  const dateRange = parseDateRange(aoa);

  let dos = parseTabular(aoa, documentType, dateRange);
  if (!dos || !dos.length) {
    dos = parsePemindahanNoNomor(aoa, dateRange);
  }
  if (!dos || !dos.length) {
    if (documentType === "item_transfer") {
      dos = parsePemindahanTabular(aoa, dateRange);
      if (!dos || !dos.length) dos = parseLabeled(aoa, documentType, dateRange);
    } else {
      dos = parseLabeled(aoa, documentType, dateRange);
    }
  }
  if (dos && dos.length && documentType === "delivery_order") {
    const cabang = parseCabang(aoa);
    if (cabang) for (const d of dos) if (!d.warehouse) d.warehouse = cabang;
  }

  return (dos || [])
    .filter((d) => d.do_number || d.outlet_name || d.do_items.length)
    .map((d) => ({ ...d, document_type: documentType }));
}
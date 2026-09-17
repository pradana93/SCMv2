// Barcode utilities for shipments — generates barcodes that encode the delivery date (arrival date).

const slug = (s) => String(s || "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();

// DO barcode format: DO{YYYYMMDD}{suffix} — suffix from do_number or outlet name
export const generateDoBarcode = (shipment) => {
  const date = (shipment.delivery_date || "").replace(/-/g, "");
  const suffix = slug(shipment.do_number).slice(-6) || slug(shipment.outlet_name).slice(0, 4) || "DO";
  return `DO${date}${suffix}`;
};

// Item barcode format: {code}{YYYYMMDD}{seq} — encodes item code + delivery date + sequence
export const generateItemBarcode = (item, shipment, index) => {
  const date = (shipment.delivery_date || "").replace(/-/g, "");
  const code = slug(item.code).slice(0, 8) || slug(item.name).slice(0, 6) || `ITM${String(index + 1).padStart(3, "0")}`;
  return `${code}${date}${String(index + 1).padStart(2, "0")}`;
};

// Generate barcodes for a shipment: one DO barcode + one per item. Preserves existing barcodes.
export const generateShipmentBarcodes = (shipment) => {
  const do_barcode = shipment.do_barcode || generateDoBarcode(shipment);
  const do_items = (shipment.do_items || []).map((it, i) => ({
    ...it,
    barcode: it.barcode || generateItemBarcode(it, shipment, i),
  }));
  return { ...shipment, do_barcode, do_items };
};

// Decode a barcode to extract the embedded delivery date and type.
export const decodeBarcode = (barcode) => {
  if (!barcode) return null;
  const doMatch = barcode.match(/^DO(\d{8})/);
  if (doMatch) {
    const d = doMatch[1];
    return { type: "do", date: `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}` };
  }
  const itemMatch = barcode.match(/(\d{8})(\d{2})$/);
  if (itemMatch) {
    const d = itemMatch[1];
    return { type: "shipment_item", date: `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`, seq: itemMatch[2] };
  }
  return null;
};

// Koli barcode format: K{shipmentIdLast12}-{koliNum}  (compact, CODE128-friendly)
export const generateKoliBarcode = (shipment, koliNum) => {
  const suffix = String(shipment?.id || "").replace(/[^a-f0-9]/gi, "").slice(-12).toUpperCase().padStart(12, "0");
  return `K${suffix}-${String(koliNum || "")}`;
};

// Decode a koli barcode → { type: "koli", suffix, koliNum } or null
export const decodeKoliBarcode = (barcode) => {
  if (!barcode) return null;
  const m = String(barcode).match(/^K([0-9A-F]{8,12})-(.+)$/i);
  if (m) return { type: "koli", suffix: m[1].toUpperCase(), koliNum: m[2] };
  return null;
};

export const formatDateId = (dateStr) => {
  if (!dateStr) return "-";
  try {
    return new Date(dateStr + "T00:00:00").toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch { return dateStr; }
};
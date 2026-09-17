// Local replacement for the Base44 `parsePdfReport` backend function.
// Original used an LLM (InvokeLLM) over an uploaded PDF to extract delivery
// orders. The independent app parses the file in-browser with best-effort
// text extraction (no extra dependencies), returning the same shape:
// { dos: [{ do_number, outlet_name, warehouse, delivery_date, document_type, do_items }] }

async function fetchAsText(fileUrl) {
  const res = await fetch(fileUrl);
  if (!res.ok) throw new Error('Gagal mengunduh file');
  const buf = await res.arrayBuffer();
  // Best-effort: PDFs often contain readable text runs alongside binary data.
  const text = new TextDecoder('latin1').decode(buf.slice(0, 2_000_000));
  return text.replace(/[^\x20-\x7E\n\r\t]/g, ' ').replace(/\s+/g, ' ');
}

export async function parsePdfReport(payload = {}) {
  const { file_url } = payload;
  if (!file_url) {
    const err = new Error('file_url diperlukan');
    err.status = 400;
    throw err;
  }
  const text = await fetchAsText(file_url);

  const dos = [];
  // Heuristic: look for DO numbers like DO-123 / SJ-... / INV-...
  const doMatches = text.match(/(?:DO|SJ|INV|DN)[\s\-#:]*[A-Z0-9][A-Z0-9\-/]{3,}/gi) || [];
  const seen = new Set();
  for (const raw of doMatches.slice(0, 50)) {
    const doNumber = raw.trim().replace(/\s+/g, ' ');
    if (seen.has(doNumber)) continue;
    seen.add(doNumber);
    dos.push({
      do_number: doNumber,
      outlet_name: '',
      warehouse: '',
      delivery_date: new Date().toISOString().slice(0, 10),
      document_type: 'delivery_order',
      do_items: [],
    });
  }

  return {
    dos,
    note:
      'Hasil ekstraksi heuristik lokal. Periksa dan lengkapi data sebelum menyimpan. ' +
      'Untuk ekstraksi LLM penuh, sambungkan penyedia AI Anda sendiri di fungsi ini.',
  };
}

Deno.serve(async (req) => {
  try {
    const { createClientFromRequest } = await import('npm:@base44/sdk@0.8.40');
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const fileUrl = body.file_url;
    if (!fileUrl) return Response.json({ error: 'No file_url provided' }, { status: 400 });

    const prompt = `Kamu adalah parser laporan pengiriman dari sistem Accurate. Ada dua format:

FORMAT 1 - "Rincian Pengiriman Pesanan":
- Setiap halaman adalah satu DO
- Label: "Nomor #" (nilai contoh: DO.2026.07.03276), "Tanggal" (nilai contoh: 24 Jul 2026), "Pelanggan" (nilai contoh: Bangor - Timika Papua)
- Tabel item: kolom "Kode #", "Nama Barang", "Kuantitas", "Satuan"
- document_type = "delivery_order"

FORMAT 2 - "Rincian Pemindahan Barang":
- Label: "No. Pemindahan #" (nilai contoh: IT.2026.07.00342), "Tanggal" (nilai contoh: 24 Jul 2026), "Gudang Tujuan/Dari" (nilai contoh: Yogya)
- Tabel item: kolom "Kode Barang", "Nama Barang", "Kuantitas", "Satuan"
- document_type = "item_transfer"
- outlet_name = nilai dari "Gudang Tujuan/Dari" (contoh: "Yogya")

INSTRUKSI:
- Ekstrak SEMUA entry yang ada dalam dokumen PDF ini
- delivery_date WAJIB diisi dalam format YYYY-MM-DD; jika label Tanggal berbunyi "24 Jul 2026" maka hasilnya "2026-07-24"
- do_number = nilai dari "Nomor #" atau "No. Pemindahan #" (termasuk prefiks DO. atau IT.)
- outlet_name = nilai dari "Pelanggan" (format 1) atau "Gudang Tujuan/Dari" (format 2)
- warehouse = nilai dari "Gudang" / "Dari Gudang" / "Gudang Asal" (gudang asal pengiriman). Untuk Pemindahan, gunakan "Dari Gudang".

Kembalikan JSON object dengan key "dos" berisi array dari semua entry.`;

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      file_urls: [fileUrl],
      response_json_schema: {
        type: "object",
        properties: {
          dos: {
            type: "array",
            items: {
              type: "object",
              properties: {
                do_number: { type: "string" },
                outlet_name: { type: "string" },
                warehouse: { type: "string" },
                delivery_date: { type: "string" },
                document_type: { type: "string" },
                do_items: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      code: { type: "string" },
                      name: { type: "string" },
                      quantity: { type: "number" },
                      unit: { type: "string" }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });

    return Response.json({ dos: result?.dos || [] });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
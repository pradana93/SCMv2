import { useRef, useState } from "react";
import { Upload } from "lucide-react";

export default function ImportPanel({ onImport }) {
  const ref = useRef();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const upload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setMessage("");
    try {
      const parsed = await onImport(file);
      if (!parsed || (Array.isArray(parsed) && !parsed.length)) throw new Error("Tidak ada data yang dikenali pada file ini.");
      setMessage(`${Array.isArray(parsed) ? parsed.length : 1} DO berhasil dibaca. Periksa data lalu simpan.`);
    } catch (err) {
      setMessage(err?.message ? `Impor gagal: ${err.message}` : "Impor gagal. Pastikan file merupakan Rincian Pengiriman Pesanan (.xlsx) dari Accurate.");
    } finally {
      setLoading(false);
      e.target.value = "";
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="text-lg font-bold">Impor Rincian Pengiriman</h2>
      <p className="mt-1 text-sm text-slate-500">Unggah file Rincian Pengiriman Pesanan atau Rincian Pemindahan Barang (.xlsx).</p>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <button onClick={() => ref.current?.click()} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60">
          <Upload className="h-4 w-4" />{loading ? "Memproses..." : "Pilih File"}
        </button>
        <input ref={ref} type="file" accept=".xlsx" onChange={upload} className="hidden" />
      </div>
      {message && <p className="mt-4 text-sm text-slate-600">{message}</p>}
      <div className="mt-5 rounded-xl bg-slate-50 p-4 text-xs leading-6 text-slate-500">
        <b>Format yang didukung:</b><br />
        • <b>Excel (.xlsx)</b>: Rincian Pengiriman Pesanan / Rincian Pemindahan Barang dari Accurate.<br />
        <b>Gudang Asal</b> terbaca otomatis; <b>Tonase</b> dapat diisi nanti pada detail DO.
      </div>
    </section>
  );
}
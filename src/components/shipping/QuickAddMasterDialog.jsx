import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";

const inputClass = "mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";

const CONFIG = {
  item: {
    title: "Tambah Barang",
    entity: "StockItem",
    nameLabel: "Nama Barang",
    fields: [{ key: "unit", label: "Satuan Dasar" }],
    build: (s) => {
      const u = (s.unit || "").trim() || "unit";
      return { name: s.name.trim(), unit: u, units: [{ name: u, conversion: 1, is_base: true }] };
    },
    queryKey: "stockItems",
    emptyMsg: "Nama barang wajib diisi.",
  },
  outlet: {
    title: "Tambah Outlet",
    entity: "Outlet",
    nameLabel: "Nama Outlet",
    fields: [{ key: "pemilik", label: "Pemilik" }, { key: "eta", label: "ETA" }],
    build: (s) => ({ name: s.name.trim(), pemilik: s.pemilik.trim(), eta: s.eta.trim() }),
    queryKey: "outlets",
    emptyMsg: "Nama outlet wajib diisi.",
  },
  warehouse: {
    title: "Tambah Gudang",
    entity: "Warehouse",
    nameLabel: "Nama Gudang",
    fields: [{ key: "pic", label: "PIC Gudang" }],
    build: (s) => ({ name: s.name.trim(), pic: s.pic.trim() }),
    queryKey: "warehouses",
    emptyMsg: "Nama gudang wajib diisi.",
  },
};

export default function QuickAddMasterDialog({ open, type, presetName, onClose }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: "", satuan: "", unit: "", pemilik: "", eta: "", pic: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setForm({ name: presetName || "", satuan: "", unit: "", pemilik: "", eta: "", pic: "" });
      setError("");
    }
  }, [open, presetName]);

  if (!type || !CONFIG[type]) return null;
  const cfg = CONFIG[type];

  const submit = async () => {
    const trimmed = form.name.trim();
    if (!trimmed) { setError(cfg.emptyMsg); return; }
    setBusy(true); setError("");
    try {
      await base44.entities[cfg.entity].create(cfg.build({ ...form, name: trimmed }));
      qc.invalidateQueries({ queryKey: [cfg.queryKey] });
      onClose();
    } catch { setError("Gagal menyimpan data."); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{cfg.title}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <label className="block text-sm font-medium">{cfg.nameLabel}
            <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} className={inputClass} autoFocus />
          </label>
          {cfg.fields.map((f) => (
            <label key={f.key} className="block text-sm font-medium">{f.label}
              <input value={form[f.key]} onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))} className={inputClass} />
            </label>
          ))}
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Batal</Button>
          <Button onClick={submit} disabled={busy}>{busy ? "Menyimpan..." : "Simpan"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
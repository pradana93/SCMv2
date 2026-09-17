import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

export default function EditEtaDialog({ open, outletName, onClose }) {
  const [eta, setEta] = useState("");
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  const { data: outlets = [] } = useQuery({ queryKey: ["outlets"], queryFn: () => base44.entities.Outlet.list() });
  const outlet = outlets.find((o) => o.name === outletName);

  useEffect(() => {
    if (outlet) setEta(String(outlet.eta || ""));
  }, [outlet?.id, outlet?.eta]);

  const save = async () => {
    if (!outlet) return;
    setBusy(true);
    try {
      await base44.entities.Outlet.update(outlet.id, { eta: eta.trim() });
      qc.invalidateQueries({ queryKey: ["outlets"] });
      qc.invalidateQueries({ queryKey: ["outlets-eta"] });
      onClose();
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Edit ETA — {outletName || "-"}</DialogTitle></DialogHeader>
        <p className="text-sm text-slate-500">Estimasi waktu tempuh (hari) dari gudang ke outlet tujuan. Digunakan untuk menghitung estimasi tanggal kedatangan.</p>
        <label className="text-sm font-medium">ETA (hari)
          <input type="number" min="0" value={eta} onChange={(e) => setEta(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" placeholder="0" />
        </label>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Batal</Button>
          <Button onClick={save} disabled={busy || !outlet}>{busy ? "Menyimpan..." : "Simpan"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";

const inputClass = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";

export default function QuickAddVendorDialog({ open, onClose, onAdded }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await base44.entities.Vendor.create({ name: name.trim(), contact: contact.trim() });
      qc.invalidateQueries({ queryKey: ["vendors"] });
      onAdded?.(name.trim());
      setName(""); setContact("");
      onClose();
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Tambah Vendor Baru</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <label className="block text-sm font-medium">Nama Vendor<input value={name} onChange={(e) => setName(e.target.value)} className={`mt-1.5 ${inputClass}`} placeholder="Nama vendor" /></label>
          <label className="block text-sm font-medium">Kontak (opsional)<input value={contact} onChange={(e) => setContact(e.target.value)} className={`mt-1.5 ${inputClass}`} placeholder="No. telp / email" /></label>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Batal</Button><Button onClick={submit} disabled={busy || !name.trim()}>{busy ? "Menyimpan..." : "Simpan"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import ShipmentForm from "./ShipmentForm";
import { WAREHOUSES, ALL_WAREHOUSES } from "./shippingUtils";

export default function ShipmentModal({ open, onClose, onSubmit, defaultWarehouse, prefill }) {
  const dw = defaultWarehouse && defaultWarehouse !== ALL_WAREHOUSES ? defaultWarehouse : WAREHOUSES[0];
  const handle = async (data) => { await onSubmit(data); onClose(); };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Tambah Pengiriman</DialogTitle>
          <DialogDescription>Masukkan data pengiriman baru.</DialogDescription>
        </DialogHeader>
        <ShipmentForm onSubmit={handle} defaultWarehouse={dw} onCancel={onClose} prefill={prefill} />
      </DialogContent>
    </Dialog>
  );
}
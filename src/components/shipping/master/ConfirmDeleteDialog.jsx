import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export default function ConfirmDeleteDialog({ open, onClose, onConfirm, count = 1, title, description }) {
  return <AlertDialog open={open} onOpenChange={(o) => !o && onClose()}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{title || (count > 1 ? `Hapus ${count} data?` : "Hapus data ini?")}</AlertDialogTitle>
        <AlertDialogDescription>{description || `Apakah Anda yakin untuk menghapus ${count > 1 ? `${count} data terpilih` : "data ini"}? Tindakan ini tidak dapat dibatalkan.`}</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Batal</AlertDialogCancel>
        <AlertDialogAction onClick={onConfirm} className="bg-red-600 text-white hover:bg-red-700">Hapus</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
}
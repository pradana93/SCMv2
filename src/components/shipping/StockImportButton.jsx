import { useRef } from "react";
import { ChevronDown, Upload, FileDown } from "lucide-react";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";

export default function StockImportButton({ label, icon, variant = "outline", onMainClick, onImport, onDownloadTemplate, disabled, importLabel = "Import Barang (.xlsx)", templateLabel = "Download Template (.xlsx)" }) {
  const ref = useRef(null);
  const isPrimary = variant === "primary";
  const wrap = isPrimary ? "flex overflow-hidden rounded-xl bg-indigo-600" : "flex overflow-hidden rounded-xl border border-slate-200 bg-white";
  const main = isPrimary
    ? "inline-flex items-center gap-1.5 px-3.5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
    : "inline-flex items-center gap-1.5 px-3.5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50";
  const chevron = isPrimary
    ? "border-l border-indigo-500/40 px-2 py-2.5 text-white/90 transition hover:bg-indigo-700"
    : "border-l border-slate-200 px-2 py-2.5 text-slate-500 transition hover:bg-slate-50";

  return (
    <>
      <div className={wrap}>
        <button type="button" onClick={onMainClick} disabled={disabled} className={main}>{icon}{label}</button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" disabled={disabled} className={chevron}><ChevronDown className="h-4 w-4" /></button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => ref.current?.click()}><Upload className="mr-2 h-4 w-4" />{importLabel}</DropdownMenuItem>
            <DropdownMenuItem onClick={onDownloadTemplate}><FileDown className="mr-2 h-4 w-4" />{templateLabel}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <input
        ref={ref}
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        onChange={(e) => { onImport?.(e.target.files?.[0]); e.target.value = ""; }}
      />
    </>
  );
}
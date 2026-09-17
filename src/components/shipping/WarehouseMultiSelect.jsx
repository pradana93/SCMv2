import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Warehouse, ChevronDown, Check } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { ALL_WAREHOUSES } from "./shippingUtils";
import { useUserWarehouses } from "./useUserWarehouses";

export default function WarehouseMultiSelect({ value = [], onChange, className = "", showAll = false, hideSelectAll = false }) {
  const { allowedWarehouses, hasAll } = useUserWarehouses();
  const { data = [] } = useQuery({ queryKey: ["warehouses"], queryFn: () => base44.entities.Warehouse.list() });
  const allList = data
    .map((w) => ({ name: w.name, pic: w.pic || "" }))
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, "id"));
  // Filter by user's allowed warehouses if restricted (unless showAll bypasses it)
  const list = showAll || !allowedWarehouses
    ? allList
    : allList.filter((w) => allowedWarehouses.includes(w.name));
  const [open, setOpen] = useState(false);

  const isAll = !value || value.length === 0;
  const toggle = (name) => {
    if (value.includes(name)) onChange(value.filter((w) => w !== name));
    else onChange([...value, name]);
  };
  const selectAll = () => onChange([]);

  const label = isAll ? (hideSelectAll ? "Pilih gudang..." : (hasAll ? ALL_WAREHOUSES : `${allowedWarehouses?.length || 0} Gudang Saya`)) : value.length === 1 ? value[0] : `${value.length} Gudang`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className={`justify-start gap-2 rounded-xl border-slate-200 bg-white font-normal ${className}`}>
          <Warehouse className="h-4 w-4 text-slate-400" />
          <span className="truncate">{label}</span>
          <ChevronDown className="ml-auto h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <div className="max-h-72 overflow-y-auto p-1">
          {hasAll && !hideSelectAll && (
            <button type="button" onClick={selectAll} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition hover:bg-accent">
              <div className="flex h-4 w-4 items-center justify-center rounded border border-input">
                {isAll && <Check className="h-3 w-3" />}
              </div>
              <span className="font-medium">{ALL_WAREHOUSES}</span>
            </button>
          )}
          {list.map((w) => {
            const checked = value.includes(w.name);
            return (
              <div key={w.name} onClick={() => toggle(w.name)} className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition hover:bg-accent">
                <Checkbox checked={checked} tabIndex={-1} className="pointer-events-none" />
                <span className="flex flex-col">
                  <span>{w.name}</span>
                  {w.pic && <span className="text-[11px] text-slate-400">PIC: {w.pic}</span>}
                </span>
              </div>
            );
          })}
          {!list.length && <p className="px-3 py-2 text-xs text-slate-400">Tidak ada gudang yang ditugaskan.</p>}
        </div>
      </PopoverContent>
    </Popover>
  );
}
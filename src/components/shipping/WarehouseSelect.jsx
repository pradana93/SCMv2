import { useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Warehouse } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { ALL_WAREHOUSES } from "./shippingUtils";

export default function WarehouseSelect({ value, onChange, className = "", includeAll = false }) {
  const { data = [] } = useQuery({ queryKey: ["warehouses"], queryFn: () => base44.entities.Warehouse.list() });
  const list = data
    .map((w) => ({ name: w.name, pic: w.pic || "" }))
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, "id"));
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={`gap-2 ${className}`}>
        <Warehouse className="h-4 w-4 text-slate-400" />
        <SelectValue placeholder="Pilih gudang" />
      </SelectTrigger>
      <SelectContent>
        {includeAll && <SelectItem value={ALL_WAREHOUSES}>{ALL_WAREHOUSES}</SelectItem>}
        {list.map((w) => (
          <SelectItem key={w.name} value={w.name}>
            <span className="flex flex-col">
              <span>{w.name}</span>
              {w.pic && <span className="text-[11px] text-slate-400">PIC: {w.pic}</span>}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
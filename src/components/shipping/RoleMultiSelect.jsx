import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

const ROLE_LABELS = { super_admin: "Super Admin", admin: "Admin", supervisor: "Supervisor", leader: "Leader", staff: "Staff", crew: "Crew", driver: "Driver" };
const ALL_ROLES = ["super_admin", "admin", "supervisor", "leader", "staff", "crew", "driver"];

export default function RoleMultiSelect({ value = [], onChange, disabled }) {
  const [open, setOpen] = useState(false);
  const roles = Array.isArray(value) ? value : [];

  const toggle = (r) => {
    if (r === "super_admin" || disabled) return;
    let next = roles.includes(r) ? roles.filter((x) => x !== r) : [...roles, r];
    if (!next.includes("super_admin")) next = [...next, "super_admin"];
    onChange?.(next);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className="inline-flex w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-indigo-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span className="flex flex-wrap gap-1">
            {roles.length === 0 ? (
              <span className="text-slate-400">Pilih role</span>
            ) : (
              roles.map((r) => (
                <span key={r} className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                  {ROLE_LABELS[r] || r}
                </span>
              ))
            )}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="start">
        <div className="space-y-1">
          {ALL_ROLES.map((r) => {
            const checked = roles.includes(r);
            const locked = r === "super_admin";
            return (
              <label
                key={r}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50",
                  (locked || disabled) && "cursor-not-allowed opacity-70"
                )}
              >
                <Checkbox checked={checked} disabled={locked || disabled} onCheckedChange={() => toggle(r)} />
                <span className="font-medium text-slate-700">{ROLE_LABELS[r] || r}</span>
                {locked && <span className="ml-auto text-[10px] text-slate-400">wajib</span>}
              </label>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
import { useState } from "react";
import { usePermissions } from "@/components/shipping/usePermissions";
import { ChevronDown, Warehouse as WarehouseIcon, Store, Truck, Tag } from "lucide-react";
import MasterWarehouseList from "@/components/shipping/master/MasterWarehouseList";
import MasterOutletList from "@/components/shipping/master/MasterOutletList";
import MasterVendorList from "@/components/shipping/master/MasterVendorList";
import MasterFleetList from "@/components/shipping/master/MasterFleetList";
import MasterCategoryList from "@/components/shipping/master/MasterCategoryList";

const SECTIONS = [
  { key: "warehouse", label: "Daftar Gudang", icon: WarehouseIcon, component: MasterWarehouseList, perms: { canDelete: "master.warehouse_delete", canEdit: "master.warehouse_edit", canAdd: "master.warehouse_add" } },
  { key: "outlet", label: "Daftar Outlet Tujuan", icon: Store, component: MasterOutletList, perms: { canDelete: "master.outlet_delete", canEdit: "master.outlet_edit", canAdd: "master.outlet_add" } },
  { key: "vendor", label: "Daftar Vendor", icon: Truck, component: MasterVendorList, perms: { canDelete: "master.vendor_delete", canEdit: "master.vendor_edit", canAdd: "master.vendor_add" } },
  { key: "fleet", label: "Daftar Armada", icon: Truck, component: MasterFleetList, perms: { canDelete: "master.fleet_delete", canEdit: "master.fleet_edit", canAdd: "master.fleet_add" } },
  { key: "category", label: "Daftar Kategori Barang", icon: Tag, component: MasterCategoryList, perms: { canDelete: "master.category_delete", canEdit: "master.category_edit", canAdd: "master.category_add" } },
];

export default function Admin() {
  const { can, canEdit, canDelete } = usePermissions();
  const [openKey, setOpenKey] = useState(null);

  const toggle = (key) => setOpenKey((prev) => (prev === key ? null : key));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Master Data</h1>
        <p className="mt-1 text-sm text-slate-500">Kelola data gudang, outlet tujuan, vendor, armada, dan kategori barang. Klik untuk melihat isi.</p>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="divide-y divide-slate-100">
          {SECTIONS.map((s) => {
            const isOpen = openKey === s.key;
            const Comp = s.component;
            const props = {};
            if (s.perms.canDelete) props.canDelete = canDelete(s.perms.canDelete);
            if (s.perms.canEdit) props.canEdit = canEdit(s.perms.canEdit);
            if (s.perms.canAdd) props.canAdd = can(s.perms.canAdd);
            return (
              <div key={s.key}>
                <button onClick={() => toggle(s.key)} className="flex w-full items-center justify-between gap-2 px-5 py-3.5 text-left transition hover:bg-slate-50">
                  <span className="flex items-center gap-2.5">
                    <s.icon className="h-5 w-5 text-indigo-600" />
                    <span className="text-sm font-bold text-slate-700">{s.label}</span>
                  </span>
                  <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </button>
                {isOpen && (
                  <div className="px-5 pb-5">
                    <Comp {...props} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
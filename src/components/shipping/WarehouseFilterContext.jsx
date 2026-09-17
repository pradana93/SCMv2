import { createContext, useContext, useState, useMemo, useEffect } from "react";
import { ALL_WAREHOUSES } from "./shippingUtils";
import { useUserWarehouses } from "./useUserWarehouses";

const WarehouseFilterContext = createContext(null);

export function WarehouseFilterProvider({ children }) {
  const { allowedWarehouses, hasAll } = useUserWarehouses();
  const [warehouses, setWarehouses] = useState(hasAll ? [] : (allowedWarehouses || []));
  useEffect(() => { if (!hasAll && allowedWarehouses) setWarehouses(allowedWarehouses); }, [hasAll, allowedWarehouses]);

  // Constrain user-selected warehouses to those they're allowed to see
  const effectiveWarehouses = useMemo(() => {
    if (!allowedWarehouses) return warehouses; // no restriction
    return warehouses.filter((w) => allowedWarehouses.includes(w));
  }, [warehouses, allowedWarehouses]);

  const isAll = effectiveWarehouses.length === 0;
  const queryFilter = isAll
    ? (allowedWarehouses ? { warehouse: { $in: allowedWarehouses } } : {})
    : { warehouse: { $in: effectiveWarehouses } };
  const warehouse = isAll ? (allowedWarehouses ? allowedWarehouses[0] : ALL_WAREHOUSES) : effectiveWarehouses[0];
  const setWarehouse = (w) => {
    if (!w || w === ALL_WAREHOUSES) setWarehouses([]);
    else setWarehouses([w]);
  };
  return (
    <WarehouseFilterContext.Provider value={{ warehouses: effectiveWarehouses, setWarehouses, warehouse, setWarehouse, isAll, queryFilter, allowedWarehouses, hasAll }}>
      {children}
    </WarehouseFilterContext.Provider>
  );
}

export function useWarehouseFilter() {
  const ctx = useContext(WarehouseFilterContext);
  if (!ctx) throw new Error("useWarehouseFilter must be used within WarehouseFilterProvider");
  return ctx;
}
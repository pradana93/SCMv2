import { useAuth } from "@/lib/AuthContext";
import { isSuperAdmin } from "./shippingUtils";
import { ALL_WAREHOUSES } from "./shippingUtils";

/**
 * Returns the user's assigned warehouses and whether they have access to all.
 * - Super admin or empty warehouses array = access to ALL warehouses.
 * - Otherwise, only the assigned warehouses are accessible.
 */
export function useUserWarehouses() {
  const { user } = useAuth();
  const isSuper = isSuperAdmin(user);
  const userWh = Array.isArray(user?.warehouses) ? user.warehouses : [];
  const hasAll = isSuper || userWh.length === 0 || userWh.includes(ALL_WAREHOUSES);
  const allowedWarehouses = hasAll ? null : userWh; // null = no restriction
  return { isSuper, userWarehouses: userWh, hasAll, allowedWarehouses };
}
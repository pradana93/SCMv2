import { createContext, useContext, useState } from "react";
import { today } from "./shippingUtils";

const DashboardDateContext = createContext(null);
const ShipmentsDateContext = createContext(null);

export function DashboardDateProvider({ children }) {
  const [dateFrom, setDateFrom] = useState(today());
  const [dateTo, setDateTo] = useState(today());
  return <DashboardDateContext.Provider value={{ dateFrom, setDateFrom, dateTo, setDateTo }}>{children}</DashboardDateContext.Provider>;
}

export function ShipmentsDateProvider({ children }) {
  const [dateFrom, setDateFrom] = useState(today());
  const [dateTo, setDateTo] = useState(today());
  return <ShipmentsDateContext.Provider value={{ dateFrom, setDateFrom, dateTo, setDateTo }}>{children}</ShipmentsDateContext.Provider>;
}

export function useDateFilter() {
  const ctx = useContext(DashboardDateContext);
  if (!ctx) throw new Error("useDateFilter must be used within DashboardDateProvider");
  return ctx;
}

export function useShipmentsDateFilter() {
  const ctx = useContext(ShipmentsDateContext);
  if (!ctx) throw new Error("useShipmentsDateFilter must be used within ShipmentsDateProvider");
  return ctx;
}
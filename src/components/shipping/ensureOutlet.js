import { base44 } from "@/api/base44Client";

export const ensureOutlet = async (name) => {
  const trimmed = (name || "").trim();
  if (!trimmed) return;
  try {
    const existing = await base44.entities.Outlet.filter({ name: trimmed });
    if (existing && existing.length) return;
    await base44.entities.Outlet.create({ name: trimmed, eta: "1 Hari" });
  } catch (_) {}
};
// Shared unit conversion helpers for stock calculations.
// All stock quantities are normalized to the base unit before aggregation,
// so movements in different units (e.g. dus vs pack) are comparable.

const norm = (s) => (s || "").trim().toLowerCase();

// Get the unit list for an item, falling back to the default unit.
export const getUnitList = (item) => {
  if (!item) return [];
  if (Array.isArray(item.units) && item.units.length > 0) return item.units;
  return item.unit ? [{ name: item.unit, conversion: 1, is_base: true }] : [];
};

// Get the base unit name for an item (the unit with is_base=true, or the first unit).
export const getBaseUnit = (item) => {
  const units = getUnitList(item);
  const base = units.find((u) => u.is_base) || units[0];
  return base?.name || item?.unit || "";
};

// Convert a quantity from a given unit to the base unit.
// conversion = how many of this unit per 1 base unit (e.g. 1 Dus = 10 Pack → Pack conversion = 10).
// So to convert to base: quantity / conversion.
// If the unit is unknown or no units are defined, returns the quantity as-is.
export const convertToBase = (item, quantity, unit) => {
  const q = Number(quantity || 0);
  const units = getUnitList(item);
  if (!units.length || !unit) return q;
  const u = units.find((x) => norm(x.name) === norm(unit));
  if (!u) return q;
  const c = Number(u.conversion || 1);
  return c > 0 ? q / c : q;
};

// Convert a quantity from the base unit to a target unit.
// Inverse of convertToBase: baseQuantity * conversion.
export const convertFromBase = (item, baseQuantity, targetUnit) => {
  const q = Number(baseQuantity || 0);
  const units = getUnitList(item);
  if (!units.length || !targetUnit) return q;
  const u = units.find((x) => norm(x.name) === norm(targetUnit));
  if (!u) return q;
  return q * Number(u.conversion || 1);
};
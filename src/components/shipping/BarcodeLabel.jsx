import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

/**
 * BarcodeLabel — render a barcode (Code128) for an item.
 * Props: value (string), displayValue (bool, default true), width, height, fontSize
 */
export default function BarcodeLabel({ value, displayValue = true, width = 2, height = 60, fontSize = 14, className = "" }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current || !value) return;
    try {
      JsBarcode(ref.current, String(value), {
        format: "CODE128",
        width,
        height,
        displayValue,
        fontSize,
        margin: 4,
        textMargin: 2,
      });
    } catch (_) {}
  }, [value, displayValue, width, height, fontSize]);
  if (!value) return <span className="text-xs text-slate-400">—</span>;
  return <svg ref={ref} className={className} />;
}
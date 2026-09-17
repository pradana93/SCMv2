import { buildDocHtml } from "./buildDocHtml";

export function printSuratJalan(item) {
  if (!item) return;
  const isItemTransfer = item.document_type === "item_transfer";
  const title = isItemTransfer ? "Item Transfer" : "Delivery Order";
  const html = buildDocHtml({ title, isPacking: false, item, sheets: [], editableRows: [], orientation: "portrait" });
  // Auto-print script runs in the new window's own context (reliable on mobile).
  const autoPrint = "<script>window.onload=function(){setTimeout(function(){window.focus();window.print();},350);};<\/script>";
  const fullHtml = html.includes("</body>") ? html.replace("</body>", autoPrint + "</body>") : html + autoPrint;
  const w = window.open("", "_blank");
  if (!w) { alert("Popup diblokir browser. Mohon izinkan popup untuk mencetak."); return; }
  w.document.write(fullHtml);
  w.document.close();
  w.focus();
}
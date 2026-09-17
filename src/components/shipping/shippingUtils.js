export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const WAREHOUSES = [
  "Gudang Jakarta",
  "Gudang Yogya",
  "Gudang Surabaya",
  "Gudang Bali",
  "Gudang Makassar",
];

export const ALL_WAREHOUSES = "Semua Gudang";
export const WAREHOUSES_WITH_ALL = [ALL_WAREHOUSES, ...WAREHOUSES];

export const statusMeta = {
  menunggu_antrian: { label: "Menunggu Antrian", className: "bg-amber-50 text-amber-700 border-amber-200" },
  proses_picking: { label: "Proses Picking", className: "bg-blue-50 text-blue-700 border-blue-200" },
  menunggu_packing: { label: "Menunggu Packing", className: "bg-slate-100 text-slate-600 border-slate-200" },
  proses_packing: { label: "Proses Packing", className: "bg-violet-50 text-violet-700 border-violet-200" },
  menunggu_loading: { label: "Menunggu Loading", className: "bg-slate-100 text-slate-600 border-slate-200" },
  proses_loading: { label: "Proses Loading", className: "bg-cyan-50 text-cyan-700 border-cyan-200" },
  sudah_dikirim: { label: "Sudah Dikirim", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  dalam_proses: { label: "Dalam Proses", className: "bg-blue-50 text-blue-700 border-blue-200" },
};

export const menungguStartTime = (deliveryDate) => {
  if (!deliveryDate) return null;
  return new Date(`${deliveryDate}T07:30:00+07:00`).toISOString();
};

export const accuracyMeta = {
  tanpa_komplain: { label: "Tanpa Komplain", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  ada_komplain: { label: "Ada Komplain", className: "bg-rose-50 text-rose-700 border-rose-200" },
  data_belum_tersedia: { label: "Data Belum Tersedia", className: "bg-slate-100 text-slate-500 border-slate-200" },
};

export const formatTonnage = (value) => `${(Math.round(Number(value || 0) * 100) / 100).toLocaleString("id-ID", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} kg`;

const SUPER_ADMIN_EMAILS = ["suhendra.a.d@gmail.com"];
export const isSuperAdmin = (user) => user?.role === "super_admin" || (!!user?.email && SUPER_ADMIN_EMAILS.includes(user.email.toLowerCase()));
export const canEditMaster = (user) => isSuperAdmin(user) || user?.role === "admin";

export const nowTimestamp = () => new Date().toISOString();

export const formatTimestamp = (value) => {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString("id-ID", {
      timeZone: "Asia/Jakarta",
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
  } catch { return value; }
};

export const formatDuration = (start, end) => {
  if (!start) return "-";
  const s = new Date(start).getTime();
  const e = end ? new Date(end).getTime() : Date.now();
  if (isNaN(s) || isNaN(e) || e < s) return "-";
  const totalMin = Math.floor((e - s) / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}j ${m}m` : `${m}m`;
};
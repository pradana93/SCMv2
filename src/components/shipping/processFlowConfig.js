export const STEPS = [
  "menunggu_antrian",
  "proses_picking",
  "menunggu_packing",
  "proses_packing",
  "menunggu_loading",
  "proses_loading",
  "sudah_dikirim",
];

export const RESET_FIELDS = {
  timestamp_proses_picking: null,
  timestamp_proses_packing: null,
  timestamp_proses_loading: null,
  timestamp_sudah_dikirim: null,
  timestamp_proses_picking_end: null,
  timestamp_proses_packing_end: null,
  timestamp_proses_loading_end: null,
  proof_file_url: null,
  proof_picking_url: null,
  proof_packing_url: null,
  accuracy: null,
  complaint_reason: null,
  complaint_type: null,
  complaint_category: null,
  picking_pic: "",
  picking_do_count: 0,
  picking_notes: "",
  picking_crew_count: 0,
  ro_received_by: "",
  packing_checker_name: "",
  packing_crew_count: 0,
  packing_total_koli: 0,
  loading_pic: "",
  loading_crew_count: 0,
  loading_koli: 0,
  loading_koli_status: "",
  packing_tonnage_status: "",
  license_plate: "",
  ro_tonnage: 0,
  crew_count: 0,
  checker_name: "",
  rescheduled_from_date: null,
  reschedule_reason: "",
  reschedule_note: "",
};

export const TARGET_TO_POPUP = {
  menunggu_antrian: null,
  proses_picking: "picking_confirm",
  menunggu_packing: "picking_selesai",
  proses_packing: "packing_confirm",
  menunggu_loading: "packing_selesai",
  proses_loading: "loading_confirm",
  sudah_dikirim: "loading_selesai",
};

export const SELESAI_TARGET = {
  proses_picking: "menunggu_packing",
  proses_packing: "menunggu_loading",
  proses_loading: "sudah_dikirim",
};

export const SELESAI_LABEL = {
  proses_picking: "Selesai Picking",
  proses_packing: "Selesai Packing",
  proses_loading: "Selesai Loading",
};

export const POPUPS = {
  picking_confirm: {
    title: "Konfirmasi Proses Picking",
    description: "Lengkapi data berikut sebelum memulai proses picking.",
    fields: [
      { key: "picking_pic", label: "Nama PIC", type: "text", placeholder: "Contoh: Andi" },
      { key: "picking_do_count", label: "Jumlah DO (dalam RO yang di proses)", type: "number", placeholder: "0" },
      { key: "picking_crew_count", label: "Crew Picking", type: "number", placeholder: "0" },
      { key: "picking_notes", label: "Catatan (opsional)", type: "textarea", placeholder: "Catatan tambahan...", optional: true },
    ],
  },
  picking_selesai: {
    title: "Selesai Picking",
    description: "Unggah bukti dan lengkapi data berikut.",
    fields: [
      { key: "proof_picking_url", label: "Upload Foto", type: "file", helpText: "Bukti Selesai Picking" },
      { key: "ro_tonnage", label: "Total Tonase RO", type: "number", placeholder: "0" },
      { key: "ro_received_by", label: "RO Diterima Oleh", type: "text", placeholder: "Contoh: Cargo" },
    ],
  },
  packing_confirm: {
    title: "Konfirmasi Proses Packing",
    description: "Lengkapi data berikut sebelum memulai proses packing.",
    fields: [
      { key: "packing_checker_name", label: "Nama Checker", type: "text", placeholder: "Contoh: Citra" },
      { key: "packing_crew_count", label: "Jumlah Crew Packing", type: "number", placeholder: "0" },
      { key: "tonnage", label: "Total Tonase DO", type: "tonnage_verify" },
    ],
  },
  packing_selesai: {
    title: "Selesai Packing",
    description: "Unggah bukti dan lengkapi data berikut.",
    fields: [
      { key: "proof_packing_url", label: "Upload Foto", type: "file", helpText: "Bukti Selesai Packing" },
      { key: "packing_total_koli", label: "Total Koli", type: "number", placeholder: "0" },
    ],
  },
  loading_confirm: {
    title: "Konfirmasi Proses Loading",
    description: "Tonase otomatis terbaca dari detail DO & proses packing (hanya baca). Verifikasi jumlah koli dari proses packing.",
    fields: [
      { key: "tonnage", label: "Total Tonase", type: "readonly" },
      { key: "loading_pic", label: "Nama PIC", type: "text", placeholder: "Contoh: Budi" },
      { key: "loading_crew_count", label: "Crew Loading", type: "number", placeholder: "0" },
      { key: "loading_koli", label: "Jumlah Koli", type: "koli_verify" },
    ],
  },
  loading_selesai: {
    title: "Selesai Loading",
    description: "Unggah bukti pengiriman dan lengkapi data berikut.",
    fields: [
      { key: "proof_file_url", label: "Upload Foto", type: "file", helpText: "Bukti Pengiriman" },
      { key: "license_plate", label: "Nomor Plat Mobil", type: "text", placeholder: "Contoh: B 1234 XYZ" },
    ],
  },
  reschedule: {
    title: "Reschedule Pengiriman",
    description: "Pilih tanggal pengiriman baru dan berikan alasan. Pengiriman akan dipindahkan ke daftar tanggal tersebut.",
    fields: [
      { key: "delivery_date", label: "Tanggal Pengiriman Baru", type: "date" },
      { key: "reschedule_reason", label: "Alasan", type: "select_other", options: [
        { value: "Ekspedisi Ganti Jadwal", label: "Ekspedisi Ganti Jadwal" },
        { value: "Overload Pengiriman", label: "Overload Pengiriman" },
        { value: "Kekurangan Stock Barang", label: "Kekurangan Stock Barang" },
        { value: "lainnya", label: "Lainnya" },
      ] },
    ],
  },
};
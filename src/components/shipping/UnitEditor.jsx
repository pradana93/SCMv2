import { Plus, Trash2, Star } from "lucide-react";

const fieldClass = "rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";

export default function UnitEditor({ units, onChange, disabled }) {
  const list = Array.isArray(units) && units.length > 0
    ? units
    : [{ name: "", conversion: 1, is_base: true }];

  const update = (idx, field, value) => {
    const next = list.map((u, i) => (i === idx ? { ...u, [field]: value } : u));
    if (field === "is_base" && value) {
      next.forEach((u, i) => { if (i !== idx) u.is_base = false; });
    }
    onChange(next);
  };

  const add = () => onChange([...list, { name: "", conversion: 1, is_base: false }]);

  const remove = (idx) => {
    if (list.length <= 1) return;
    const next = list.filter((_, i) => i !== idx);
    if (!next.some((u) => u.is_base)) next[0].is_base = true;
    onChange(next);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        <span className="flex-1">Nama Satuan</span>
        <span className="w-24 text-center">Konversi</span>
        <span className="w-9 text-center">Dasar</span>
        <span className="w-9" />
      </div>
      {list.map((u, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <input
            value={u.name}
            onChange={(e) => update(idx, "name", e.target.value)}
            placeholder="mis. pack, dus"
            className={`flex-1 ${fieldClass}`}
            disabled={disabled}
          />
          <input
            type="number"
            min="0"
            step="0.001"
            value={u.conversion}
            onChange={(e) => update(idx, "conversion", Number(e.target.value) || 0)}
            placeholder="1"
            className={`w-24 ${fieldClass}`}
            disabled={disabled}
          />
          <button
            type="button"
            onClick={() => update(idx, "is_base", !u.is_base)}
            disabled={disabled}
            className={`w-9 shrink-0 rounded-lg p-2 transition ${u.is_base ? "text-amber-500 hover:bg-amber-50" : "text-slate-300 hover:bg-slate-50"}`}
            title="Jadikan satuan dasar"
          >
            <Star className="h-4 w-4" fill={u.is_base ? "currentColor" : "none"} />
          </button>
          {list.length > 1 && (
            <button
              type="button"
              onClick={() => remove(idx)}
              disabled={disabled}
              className="w-9 shrink-0 rounded-lg p-2 text-red-600 transition hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        disabled={disabled}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:text-indigo-700"
      >
        <Plus className="h-4 w-4" /> Tambah Satuan
      </button>
      <p className="text-[11px] text-slate-400">
        Konversi = jumlah satuan ini per 1 satuan dasar. Mis. 1 dus = 10 pack, maka konversi pack = 10. Satuan dasar (bintang) memiliki konversi 1.
      </p>
    </div>
  );
}
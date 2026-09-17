import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Pencil, Trash2, ArrowLeftRight, Trash } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";
import ConfirmDeleteDialog from "@/components/shipping/master/ConfirmDeleteDialog";
import WarehouseSelect from "@/components/shipping/WarehouseSelect";
import WarehouseMultiSelect from "@/components/shipping/WarehouseMultiSelect";
import { formatTimestamp } from "@/components/shipping/shippingUtils";
import { usePermissions } from "@/components/shipping/usePermissions";

const norm = (s) => (s || "").trim().toLowerCase();
const inputClass = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100";
const today = () => new Date().toISOString().slice(0, 10);
const formatDate = (v) => { if (!v) return "-"; try { const d = new Date(v.length <= 10 ? v + "T00:00:00" : v); return isNaN(d.getTime()) ? v : d.toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" }); } catch { return v; } };

export default function StockTransactionList() {
  const { can, canEdit, canDelete } = usePermissions();
  const qc = useQueryClient();
  const { data: movements = [], isLoading } = useQuery({ queryKey: ["stockMovements"], queryFn: () => base44.entities.StockMovement.list("-created_date", 500) });
  const { data: users = [] } = useQuery({ queryKey: ["users"], queryFn: () => base44.entities.User.list() });
  const { data: warehouseList = [] } = useQuery({ queryKey: ["warehouses"], queryFn: () => base44.entities.Warehouse.list() });
  const userMap = useMemo(() => { const m = new Map(); for (const u of users) m.set(u.id, u.full_name || u.email || "-"); return m; }, [users]);

  const canView = can("stock.transaction");
  const canEditTx = canEdit("stock.transaction");
  const canDelTx = canDelete("stock.transaction");

  const [search, setSearch] = useState("");
  const [wh, setWh] = useState([]);
  const [typeFilter, setTypeFilter] = useState("all");
  const [editing, setEditing] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [confirmBulk, setConfirmBulk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [fQty, setFQty] = useState("");
  const [fDate, setFDate] = useState(today());
  const [fNote, setFNote] = useState("");
  const [fWh, setFWh] = useState("");

  const refresh = () => { qc.invalidateQueries({ queryKey: ["stockMovements"] }); qc.invalidateQueries({ queryKey: ["stockItems"] }); };

  const rows = useMemo(() => {
    let list = [...movements];
    if (wh.length > 0) list = list.filter((m) => wh.includes(m.warehouse));
    if (typeFilter !== "all") {
      if (typeFilter === "transfer") list = list.filter((m) => m.reference === "transfer");
      else if (typeFilter === "import") list = list.filter((m) => m.reference === "import");
      else list = list.filter((m) => m.reference !== "transfer" && m.reference !== "import" && m.type === typeFilter);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((m) => String(m.item_name || "").toLowerCase().includes(q) || String(m.note || "").toLowerCase().includes(q));
    }
    list.sort((a, b) => {
      const da = String(a.date || ""), db = String(b.date || "");
      if (db !== da) return db.localeCompare(da);
      return String(b.created_date || "").localeCompare(String(a.created_date || ""));
    });
    return list;
  }, [movements, wh, typeFilter, search]);

  const openEdit = (m) => {
    setEditing(m);
    setFQty(String(m.quantity ?? ""));
    setFDate(m.date || today());
    setFNote(m.note || "");
    setFWh(m.warehouse || "");
  };

  const saveEdit = async () => {
    if (!editing || !fQty) return;
    setBusy(true);
    try {
      await base44.entities.StockMovement.update(editing.id, { quantity: Number(fQty) || 0, date: fDate || today(), note: fNote.trim(), warehouse: fWh });
      setEditing(null);
      refresh();
    } finally { setBusy(false); }
  };

  const doDelete = async () => {
    const id = confirmId;
    setConfirmId(null);
    if (!id) return;
    setBusy(true);
    try { await base44.entities.StockMovement.delete(id); refresh(); } finally { setBusy(false); }
  };

  const doBulkDelete = async () => {
    setConfirmBulk(false);
    if (!selected.size) return;
    setBusy(true);
    try {
      for (const id of selected) { await base44.entities.StockMovement.delete(id); }
      setSelected(new Set());
      refresh();
    } finally { setBusy(false); }
  };

  const toggleSelect = (id) => {
    setSelected((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  };
  const toggleSelectAll = () => {
    setSelected((prev) => { if (prev.size === rows.length) return new Set(); return new Set(rows.map((r) => r.id)); });
  };

  const getByLabel = (m) => {
    const name = userMap.get(m.created_by_id) || "-";
    if (m.reference === "import") return `Import by ${name}`;
    return name;
  };

  const typeBadgeCls = (t) => t === "masuk" ? "bg-emerald-50 text-emerald-700" : t === "transfer" ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-600";
  const typeLabel = (t) => t === "masuk" ? "Masuk" : t === "transfer" ? "Transfer" : "Keluar";

  if (!canView) {
    return <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center"><p className="text-sm text-slate-500">Anda tidak memiliki akses untuk melihat daftar transaksi stok.</p></div>;
  }

  return (
    <div>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <WarehouseMultiSelect value={wh} onChange={setWh} className="w-full sm:w-[220px]" />
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="sm:w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Tipe</SelectItem>
            <SelectItem value="masuk">Stok Masuk</SelectItem>
            <SelectItem value="keluar">Stok Keluar</SelectItem>
            <SelectItem value="transfer">Transfer Stock</SelectItem>
            <SelectItem value="import">Hasil Import</SelectItem>
          </SelectContent>
        </Select>
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari barang atau keterangan..." className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" />
        </div>
      </div>

      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm text-slate-500">{rows.length} transaksi</p>
        {canDelTx && rows.length > 0 && (
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <Checkbox checked={selected.size === rows.length && rows.length > 0} onCheckedChange={toggleSelectAll} />
              Pilih Semua
            </label>
            {selected.size > 0 && (
              <button onClick={() => setConfirmBulk(true)} disabled={busy} className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60">
                <Trash className="h-4 w-4" />Hapus ({selected.size})
              </button>
            )}
          </div>
        )}
      </div>

      {isLoading ? <div className="flex justify-center py-12"><div className="h-7 w-7 animate-spin rounded-full border-4 border-indigo-100 border-t-indigo-600" /></div> :
        rows.length === 0 ? <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white py-12 text-center"><ArrowLeftRight className="h-8 w-8 text-slate-300" /><p className="mt-3 text-sm text-slate-500">Belum ada transaksi sesuai filter.</p></div> :
          <>
          <div className="md:hidden space-y-2">
            {rows.map((m) => {
              const isTransfer = m.reference === "transfer";
              const isImport = m.reference === "import";
              const type = isTransfer ? "transfer" : m.type;
              return (
                <div key={m.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs text-slate-500">{formatDate(m.date)}</span>
                      {m.created_date && <span className="ml-1.5 text-[11px] text-slate-400">{formatTimestamp(m.created_date)}</span>}
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${typeBadgeCls(type)}`}>{typeLabel(type)}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    {canDelTx && <Checkbox checked={selected.has(m.id)} onCheckedChange={() => toggleSelect(m.id)} />}
                    <p className="text-sm font-semibold text-slate-800 flex-1">{m.item_name || "-"}{m.unit ? <span className="ml-1 text-xs text-slate-400">{m.unit}</span> : null}</p>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-xs">
                    <span className="text-slate-500">{m.warehouse || "-"}</span>
                    <span className={`font-semibold ${type === "masuk" ? "text-emerald-600" : "text-rose-600"}`}>{type === "masuk" ? "+" : "-"}{Number(m.quantity || 0).toLocaleString("id-ID")}</span>
                  </div>
                  {m.note && <p className="mt-1 text-xs text-slate-400 truncate">{m.note}</p>}
                  <div className="mt-1.5 flex items-center justify-between">
                    <span className={`text-[11px] ${isImport ? "font-semibold text-indigo-600" : "text-slate-400"}`}>{getByLabel(m)}</span>
                    {(canEditTx || canDelTx) && (
                      <div className="flex gap-1">
                        {canEditTx && <button onClick={() => openEdit(m)} disabled={busy} className="rounded-lg p-1.5 text-slate-600 transition hover:bg-slate-100"><Pencil className="h-3.5 w-3.5" /></button>}
                        {canDelTx && <button onClick={() => setConfirmId(m.id)} disabled={busy} className="rounded-lg p-1.5 text-red-600 transition hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" /></button>}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="hidden md:block overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  {canDelTx && <th className="px-3 py-3 w-10"></th>}
                  <th className="px-3 py-3">Tanggal</th>
                  <th className="px-3 py-3">Barang</th>
                  <th className="px-3 py-3">Tipe</th>
                  <th className="px-3 py-3">Gudang</th>
                  <th className="px-3 py-3 text-right">Jumlah</th>
                  <th className="px-3 py-3">Keterangan</th>
                  <th className="px-3 py-3">Oleh</th>
                  {(canEditTx || canDelTx) && <th className="px-3 py-3 text-right">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((m) => {
                  const isTransfer = m.reference === "transfer";
                  const isImport = m.reference === "import";
                  const type = isTransfer ? "transfer" : m.type;
                  return (
                    <tr key={m.id} className="hover:bg-slate-50/60">
                      {canDelTx && (
                        <td className="px-3 py-3"><Checkbox checked={selected.has(m.id)} onCheckedChange={() => toggleSelect(m.id)} /></td>
                      )}
                      <td className="px-3 py-3 text-slate-600 whitespace-nowrap"><div>{formatDate(m.date)}</div>{m.created_date && <div className="text-[11px] text-slate-400">{formatTimestamp(m.created_date)}</div>}</td>
                      <td className="px-3 py-3 font-medium text-slate-700">{m.item_name || "-"}{m.unit ? <span className="ml-1 text-xs text-slate-400">{m.unit}</span> : null}</td>
                      <td className="px-3 py-3"><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${typeBadgeCls(type)}`}>{typeLabel(type)}</span></td>
                      <td className="px-3 py-3 text-slate-600">{m.warehouse || "-"}</td>
                      <td className={`px-3 py-3 text-right font-semibold ${type === "masuk" ? "text-emerald-600" : "text-rose-600"}`}>{type === "masuk" ? "+" : "-"}{Number(m.quantity || 0).toLocaleString("id-ID")}</td>
                      <td className="px-3 py-3 text-slate-500 max-w-[220px] truncate" title={m.note || ""}>{m.note || "-"}</td>
                      <td className={`px-3 py-3 text-xs ${isImport ? "font-semibold text-indigo-600" : "text-slate-500"}`}>{getByLabel(m)}</td>
                      {(canEditTx || canDelTx) && (
                        <td className="px-3 py-3">
                          <div className="flex items-center justify-end gap-1">
                            {canEditTx && <button onClick={() => openEdit(m)} disabled={busy} className="rounded-lg p-1.5 text-slate-600 transition hover:bg-slate-100" title="Edit"><Pencil className="h-3.5 w-3.5" /></button>}
                            {canDelTx && <button onClick={() => setConfirmId(m.id)} disabled={busy} className="rounded-lg p-1.5 text-red-600 transition hover:bg-red-50" title="Hapus"><Trash2 className="h-3.5 w-3.5" /></button>}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </>}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Edit Transaksi</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs">
                <p className="text-slate-400">Barang</p>
                <p className="text-sm font-bold text-slate-800">{editing.item_name}</p>
                <p className="mt-1 text-slate-400">Tipe: <span className="font-semibold text-slate-600">{editing.reference === "transfer" ? "Transfer" : editing.reference === "import" ? "Hasil Import" : editing.type === "masuk" ? "Stok Masuk" : "Stok Keluar"}</span></p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm font-medium">Jumlah<input type="number" min="0" value={fQty} onChange={(e) => setFQty(e.target.value)} className={`mt-1.5 ${inputClass}`} /></label>
                <label className="text-sm font-medium">Tanggal<input type="date" value={fDate} onChange={(e) => setFDate(e.target.value)} className={`mt-1.5 ${inputClass}`} /></label>
              </div>
              <label className="block text-sm font-medium">Gudang<div className="mt-1.5"><WarehouseSelect value={fWh} onChange={setFWh} className="w-full" /></div></label>
              <label className="block text-sm font-medium">Keterangan<input value={fNote} onChange={(e) => setFNote(e.target.value)} className={`mt-1.5 ${inputClass}`} placeholder="Catatan (opsional)" /></label>
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setEditing(null)}>Batal</Button><Button onClick={saveEdit} disabled={busy || !fQty}>{busy ? "Menyimpan..." : "Simpan"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog open={!!confirmId} onClose={() => setConfirmId(null)} onConfirm={doDelete} />
      <ConfirmDeleteDialog open={confirmBulk} onClose={() => setConfirmBulk(false)} onConfirm={doBulkDelete} count={selected.size} />
    </div>
  );
}
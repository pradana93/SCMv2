import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

export function useShipmentMutations() {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["shipments"] });

  const snapshotAndCancel = async () => {
    await queryClient.cancelQueries({ queryKey: ["shipments"] });
    return queryClient.getQueriesData({ queryKey: ["shipments"] });
  };

  const rollback = (snapshots) => {
    snapshots.forEach(([queryKey, data]) => queryClient.setQueryData(queryKey, data));
  };

  const optimisticUpdate = (id, patch) => {
    queryClient.setQueriesData({ queryKey: ["shipments"] }, (old) => {
      if (!Array.isArray(old)) return old;
      return old.map((s) => (s.id === id ? { ...s, ...patch } : s));
    });
  };

  const updateStatus = async (id, payload) => {
    const snapshots = await snapshotAndCancel();
    optimisticUpdate(id, payload);
    try {
      await base44.entities.Shipment.update(id, payload);
    } catch (err) {
      rollback(snapshots);
      throw err;
    } finally {
      refresh();
    }
  };

  const deliverShipment = async (item, { file, checker_name, crew_count, tonnage }) => {
    const now = new Date().toISOString();
    const patch = {
      status: "sudah_dikirim",
      timestamp_sudah_dikirim: now,
      checker_name,
      crew_count,
    };
    if (item.timestamp_proses_loading && !item.timestamp_proses_loading_end) patch.timestamp_proses_loading_end = now;
    if (tonnage != null && !Number.isNaN(Number(tonnage))) patch.tonnage = Number(tonnage);

    const snapshots = await snapshotAndCancel();
    optimisticUpdate(item.id, patch);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      await base44.entities.Shipment.update(item.id, { ...patch, proof_file_url: file_url });
    } catch (err) {
      rollback(snapshots);
      throw err;
    } finally {
      refresh();
    }
  };

  const deleteShipment = async (id) => {
    const snapshots = await snapshotAndCancel();
    queryClient.setQueriesData({ queryKey: ["shipments"] }, (old) => {
      if (!Array.isArray(old)) return old;
      return old.filter((s) => s.id !== id);
    });
    try {
      await base44.entities.Shipment.delete(id);
    } catch (err) {
      rollback(snapshots);
      throw err;
    } finally {
      refresh();
    }
  };

  const deleteShipments = async (ids) => {
    const idSet = new Set(ids);
    const snapshots = await snapshotAndCancel();
    queryClient.setQueriesData({ queryKey: ["shipments"] }, (old) => {
      if (!Array.isArray(old)) return old;
      return old.filter((s) => !idSet.has(s.id));
    });
    try {
      await base44.entities.Shipment.deleteMany({ id: { $in: ids } });
    } catch (err) {
      rollback(snapshots);
      throw err;
    } finally {
      refresh();
    }
  };

  return { updateStatus, deliverShipment, deleteShipment, deleteShipments };
}
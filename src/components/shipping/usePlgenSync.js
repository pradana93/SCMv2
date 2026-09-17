import { useEffect, useRef, useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/AuthContext";
import { syncPlgenShipments, isPlgenSyncConfigured } from "@/api/functions/plgenSync";

const LAST_SYNC_KEY = "scm_plgen_last_sync";
const SYNC_INTERVAL_MS = 3 * 60 * 1000;

// Auto-import new PLGen exports as Shipments when the Pengiriman page is
// visited (same pattern as useAutoSyncReceipts on Penerimaan). Silent on
// failure; dedup by do_number inside the service.
// Returns { syncNow, syncing, lastResult } for the manual Sync button.
export function usePlgenSync() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const runningRef = useRef(false);
  const [syncing, setSyncing] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  const syncNow = useCallback(async () => {
    if (!isPlgenSyncConfigured || runningRef.current) return null;
    runningRef.current = true;
    setSyncing(true);
    try {
      const res = await syncPlgenShipments();
      try {
        localStorage.setItem(LAST_SYNC_KEY, String(Date.now()));
      } catch {
        // ignore storage errors
      }
      if (res && res.created && res.created.length) {
        qc.invalidateQueries({ queryKey: ["shipments"] });
      }
      setLastResult(res);
      return res;
    } catch (e) {
      const err = { error: (e && e.message) || "Gagal sync dari PLGen" };
      setLastResult(err);
      return err;
    } finally {
      runningRef.current = false;
      setSyncing(false);
    }
  }, [qc]);

  useEffect(() => {
    if (!isPlgenSyncConfigured || !user || runningRef.current) return;
    let last = 0;
    try {
      last = Number(localStorage.getItem(LAST_SYNC_KEY) || 0);
    } catch {
      // ignore storage errors
    }
    if (Date.now() - last < SYNC_INTERVAL_MS) return;
    syncNow();
  }, [qc, user && user.id, syncNow]);

  return { syncNow, syncing, lastResult };
}

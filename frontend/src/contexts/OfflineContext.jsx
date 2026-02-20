import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import {
  syncOfflineQueue,
  getPendingCount,
  getFailedCount,
  OFFLINE_SYNC_EVENT,
} from "../services/offlineQueueService.js";
import { manualSyncAll } from "../services/syncService.js";
import { getPendingVerificationCount } from "../services/syncService.js";

// ============================================
// Offline Context
// Provides network status, pending queue counts,
// sync state, and a manual-sync action to the
// entire component tree.
// ============================================

const OfflineContext = createContext(null);

export function OfflineProvider({ children }) {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState(null); // { synced, failed, errors, ts }
  const refreshTimer = useRef(null);

  // ---- Refresh counts from IndexedDB ----
  const refreshCounts = useCallback(async () => {
    try {
      const [pq, fq, pv] = await Promise.all([
        getPendingCount(),
        getFailedCount(),
        getPendingVerificationCount(),
      ]);
      setPendingCount(pq + pv);
      setFailedCount(fq);
    } catch {
      /* db read may fail during upgrade */
    }
  }, []);

  // ---- Manual sync ----
  const triggerSync = useCallback(async () => {
    if (syncing || !navigator.onLine) return;
    setSyncing(true);
    try {
      const result = await manualSyncAll();
      const totalSynced =
        (result.verifications?.synced || 0) + (result.queue?.synced || 0);
      const totalFailed =
        (result.verifications?.failed || 0) + (result.queue?.failed || 0);
      setLastSyncResult({
        synced: totalSynced,
        failed: totalFailed,
        errors: [...(result.verifications?.errors || []), ...(result.queue?.errors || [])],
        ts: Date.now(),
      });
    } catch (err) {
      setLastSyncResult({
        synced: 0,
        failed: -1,
        errors: [{ error: err.message }],
        ts: Date.now(),
      });
    } finally {
      setSyncing(false);
      refreshCounts();
    }
  }, [syncing, refreshCounts]);

  // ---- Listen for online / offline events ----
  useEffect(() => {
    const goOnline = () => {
      setIsOnline(true);
      // Auto sync is handled by initSyncListeners in syncService;
      // we just refresh counts after a short delay
      setTimeout(refreshCounts, 2000);
    };
    const goOffline = () => setIsOnline(false);

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, [refreshCounts]);

  // ---- Listen for custom sync events from offlineQueueService ----
  useEffect(() => {
    const handler = () => refreshCounts();
    window.addEventListener(OFFLINE_SYNC_EVENT, handler);
    return () => window.removeEventListener(OFFLINE_SYNC_EVENT, handler);
  }, [refreshCounts]);

  // ---- Poll counts every 10s while the tab is visible ----
  useEffect(() => {
    refreshCounts();
    refreshTimer.current = setInterval(refreshCounts, 10_000);
    return () => clearInterval(refreshTimer.current);
  }, [refreshCounts]);

  const value = {
    isOnline,
    pendingCount,
    failedCount,
    syncing,
    lastSyncResult,
    triggerSync,
    refreshCounts,
  };

  return (
    <OfflineContext.Provider value={value}>{children}</OfflineContext.Provider>
  );
}

/**
 * Hook to consume OfflineContext.
 * Must be used within <OfflineProvider>.
 */
export function useOffline() {
  const ctx = useContext(OfflineContext);
  if (!ctx) {
    throw new Error("useOffline must be used within <OfflineProvider>");
  }
  return ctx;
}

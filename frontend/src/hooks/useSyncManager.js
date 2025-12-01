import { useEffect, useCallback } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, postVerification } from "../services";

/**
 * Custom hook to manage syncing of pending verifications
 * @returns {Object} Object containing pending tasks and sync function
 */
export function useSyncManager() {
  // Get all pending verifications from Dexie using live query
  const pendingTasks = useLiveQuery(
    () => db.pendingVerifications.toArray(),
    []
  );

  /**
   * Sync all pending tasks with the backend
   */
  const syncPendingTasks = useCallback(async () => {
    if (!pendingTasks || pendingTasks.length === 0) {
      return;
    }

    console.log(`Syncing ${pendingTasks.length} pending tasks...`);

    for (const task of pendingTasks) {
      try {
        // Try to send the task to the backend
        await postVerification(task.taskId, task.data?.notes || "");

        // If successful, delete from IndexedDB
        await db.pendingVerifications.delete(task.id);
        console.log(`Successfully synced and removed task ${task.taskId}`);
      } catch (error) {
        console.error(`Failed to sync task ${task.taskId}:`, error);
        // Keep it in the database to retry later
      }
    }
  }, [pendingTasks]);

  /**
   * Sync all pending data
   */
  const syncAll = useCallback(async () => {
    await syncPendingTasks();
  }, [syncPendingTasks]);

  // Listen for the 'online' event and sync when back online
  useEffect(() => {
    const handleOnline = () => {
      console.log("Back online! Syncing pending data...");
      syncAll();
    };

    window.addEventListener("online", handleOnline);

    // Cleanup listener on unmount
    return () => {
      window.removeEventListener("online", handleOnline);
    };
  }, [syncAll]);

  // If we already have pending data and we're online, attempt an immediate sync
  useEffect(() => {
    if (!navigator.onLine) {
      return;
    }

    const hasPendingTasks = pendingTasks && pendingTasks.length > 0;

    if (!hasPendingTasks) {
      return;
    }

    syncAll();
  }, [pendingTasks, syncAll]);

  return {
    pendingTasks: pendingTasks || [],
    syncPendingTasks,
    syncAll,
  };
}

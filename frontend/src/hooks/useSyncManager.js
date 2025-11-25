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

  // Listen for the 'online' event and sync when back online
  useEffect(() => {
    const handleOnline = () => {
      console.log("Back online! Syncing pending tasks...");
      syncPendingTasks();
    };

    window.addEventListener("online", handleOnline);

    // Cleanup listener on unmount
    return () => {
      window.removeEventListener("online", handleOnline);
    };
  }, [syncPendingTasks]);

  // If we already have pending tasks and we're online, attempt an immediate sync
  useEffect(() => {
    if (!navigator.onLine) {
      return;
    }

    if (!pendingTasks || pendingTasks.length === 0) {
      return;
    }

    syncPendingTasks();
  }, [pendingTasks, syncPendingTasks]);

  return {
    pendingTasks: pendingTasks || [],
    syncPendingTasks,
  };
}

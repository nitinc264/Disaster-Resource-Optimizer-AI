import { db } from "./db.js";
import { postVerification } from "./apiService.js";

// Event name for sync completion notification
export const SYNC_COMPLETE_EVENT = "verification-sync-complete";

/**
 * Sync all pending verifications when coming back online
 * @returns {Promise<Object>} Results of sync operation
 */
export async function syncPendingVerifications() {
  if (!navigator.onLine) {
    return { success: false, message: "Still offline", synced: 0, failed: 0 };
  }

  try {
    const pendingVerifications = await db.pendingVerifications.toArray();

    if (pendingVerifications.length === 0) {
      return {
        success: true,
        message: "No pending verifications",
        synced: 0,
        failed: 0,
      };
    }

    let synced = 0;
    let failed = 0;
    const errors = [];

    for (const verification of pendingVerifications) {
      try {
        // Post verification to server
        await postVerification(
          verification.taskId,
          verification.data?.notes || ""
        );

        // Remove from IndexedDB on success
        await db.pendingVerifications.delete(verification.id);
        synced++;
      } catch (error) {
        console.error(
          `Failed to sync verification ${verification.taskId}:`,
          error
        );
        failed++;
        errors.push({
          taskId: verification.taskId,
          error: error.message,
        });
      }
    }

    // Dispatch custom event to notify components about sync completion
    if (synced > 0) {
      window.dispatchEvent(
        new CustomEvent(SYNC_COMPLETE_EVENT, {
          detail: { synced, failed, errors },
        })
      );
    }

    return {
      success: true,
      message: `Synced ${synced} verifications${
        failed > 0 ? `, ${failed} failed` : ""
      }`,
      synced,
      failed,
      errors,
    };
  } catch (error) {
    console.error("Sync error:", error);
    return {
      success: false,
      message: error.message,
      synced: 0,
      failed: 0,
    };
  }
}

/**
 * Get count of pending verifications
 * @returns {Promise<number>} Number of pending verifications
 */
export async function getPendingVerificationCount() {
  try {
    return await db.pendingVerifications.count();
  } catch {
    return 0;
  }
}

/**
 * Initialize sync listeners for automatic syncing when coming online
 */
export function initSyncListeners() {
  let syncInProgress = false;

  const handleOnline = async () => {
    if (syncInProgress) return;

    syncInProgress = true;
    console.log("Network restored - syncing pending verifications...");

    try {
      const result = await syncPendingVerifications();
      console.log("Sync result:", result);
    } catch (error) {
      console.error("Auto-sync failed:", error);
    } finally {
      syncInProgress = false;
    }
  };

  // Listen for online event
  window.addEventListener("online", handleOnline);

  // Return cleanup function
  return () => {
    window.removeEventListener("online", handleOnline);
  };
}

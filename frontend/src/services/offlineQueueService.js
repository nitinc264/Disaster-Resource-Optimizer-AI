import { db } from "./db.js";
import { apiClient } from "./api.js";

// ============================================
// Offline Queue Service
// Queues all mutating requests (POST/PUT/PATCH/DELETE)
// when the app is offline, and replays them on reconnect.
// ============================================

/** Custom event dispatched after every sync attempt */
export const OFFLINE_SYNC_EVENT = "offline-sync-status";

/**
 * Add a request to the offline queue (IndexedDB).
 * @param {Object} request - Axios-style request config
 * @param {string} request.method - HTTP method
 * @param {string} request.url - Request URL (relative to API base)
 * @param {Object} [request.data] - Request body
 * @param {Object} [request.headers] - Extra headers
 * @param {string} [request.label] - Human-readable label for the pending action
 * @returns {Promise<number>} The queued item ID
 */
export async function enqueueRequest(request) {
  const entry = {
    method: request.method,
    url: request.url,
    data: request.data || null,
    headers: request.headers || null,
    label: request.label || `${request.method.toUpperCase()} ${request.url}`,
    createdAt: new Date().toISOString(),
    status: "pending", // pending | synced | failed
    lastError: null,
    retries: 0,
  };

  const id = await db.offlineQueue.add(entry);

  // Notify listeners about the new queued item
  _dispatchSyncEvent();

  return id;
}

/**
 * Get all pending (un-synced) requests.
 * @returns {Promise<Array>}
 */
export async function getPendingRequests() {
  return db.offlineQueue.where("status").equals("pending").toArray();
}

/**
 * Get count of pending requests.
 * @returns {Promise<number>}
 */
export async function getPendingCount() {
  try {
    return await db.offlineQueue.where("status").equals("pending").count();
  } catch {
    return 0;
  }
}

/**
 * Get all failed requests.
 * @returns {Promise<Array>}
 */
export async function getFailedRequests() {
  return db.offlineQueue.where("status").equals("failed").toArray();
}

/**
 * Get count of failed requests.
 * @returns {Promise<number>}
 */
export async function getFailedCount() {
  try {
    return await db.offlineQueue.where("status").equals("failed").count();
  } catch {
    return 0;
  }
}

/**
 * Replay all pending requests against the server, in FIFO order.
 * @returns {Promise<{synced: number, failed: number, errors: Array}>}
 */
export async function syncOfflineQueue() {
  if (!navigator.onLine) {
    return { synced: 0, failed: 0, errors: [], stillOffline: true };
  }

  const pending = await db.offlineQueue
    .where("status")
    .anyOf(["pending", "failed"])
    .sortBy("id");

  if (pending.length === 0) {
    return { synced: 0, failed: 0, errors: [] };
  }

  let synced = 0;
  let failed = 0;
  const errors = [];

  for (const item of pending) {
    try {
      await apiClient.request({
        method: item.method,
        url: item.url,
        data: item.data,
        headers: item.headers || {},
      });

      // Success — remove from queue
      await db.offlineQueue.delete(item.id);
      synced++;
    } catch (err) {
      const message = err?.response?.data?.message || err.message;
      failed++;
      errors.push({ id: item.id, label: item.label, error: message });

      // Mark as failed so manual retry can target it
      await db.offlineQueue.update(item.id, {
        status: "failed",
        lastError: message,
        retries: (item.retries || 0) + 1,
      });
    }
  }

  _dispatchSyncEvent({ synced, failed, errors });

  return { synced, failed, errors };
}

/**
 * Retry a single failed request by ID.
 * @param {number} id
 * @returns {Promise<boolean>} true if synced successfully
 */
export async function retrySingleRequest(id) {
  const item = await db.offlineQueue.get(id);
  if (!item) return false;

  try {
    await apiClient.request({
      method: item.method,
      url: item.url,
      data: item.data,
      headers: item.headers || {},
    });
    await db.offlineQueue.delete(id);
    _dispatchSyncEvent();
    return true;
  } catch (err) {
    const message = err?.response?.data?.message || err.message;
    await db.offlineQueue.update(id, {
      lastError: message,
      retries: (item.retries || 0) + 1,
    });
    _dispatchSyncEvent();
    return false;
  }
}

/**
 * Discard a failed request (remove it from the queue permanently).
 * @param {number} id
 */
export async function discardRequest(id) {
  await db.offlineQueue.delete(id);
  _dispatchSyncEvent();
}

/**
 * Clear the entire offline queue.
 */
export async function clearQueue() {
  await db.offlineQueue.clear();
  _dispatchSyncEvent();
}

// ------ internal helper ------
function _dispatchSyncEvent(detail = {}) {
  window.dispatchEvent(
    new CustomEvent(OFFLINE_SYNC_EVENT, { detail }),
  );
}

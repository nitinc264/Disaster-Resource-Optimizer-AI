import axios from "axios";
import { getStoredAuth } from "./authService";
import { enqueueRequest } from "./offlineQueueService";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";

// HTTP methods that mutate data and should be queued when offline
const MUTATING_METHODS = ["post", "put", "patch", "delete"];

// Set up a base URL for your backend API
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true, // Enable sending cookies for session management
});

// Ensure auth header is set if a PIN is stored (helps after page refreshes)
try {
  const auth = getStoredAuth?.();
  if (auth?.pin) {
    apiClient.defaults.headers.common["x-auth-pin"] = auth.pin;
  }
} catch {
  // ignore storage errors
}

// Ensure auth header is attached for every request (covers refresh and new tabs)
apiClient.interceptors.request.use(
  (config) => {
    try {
      const auth = getStoredAuth?.();
      if (auth?.pin) {
        config.headers = config.headers || {};
        config.headers["x-auth-pin"] = auth.pin;
      }
    } catch {
      /* ignore */
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ============================================
// Offline Interceptor
// If a mutating request fails because the device
// is offline (no response from server), queue it
// in IndexedDB for later replay.
// ============================================
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config || {};
    const method = (config.method || "").toLowerCase();

    // Only intercept network errors on mutating requests
    const isNetworkError = !error.response && !navigator.onLine;
    const isMutating = MUTATING_METHODS.includes(method);

    // Skip if this request was already a replay from the sync queue
    if (config._fromOfflineSync) {
      return Promise.reject(error);
    }

    if (isNetworkError && isMutating) {
      try {
        await enqueueRequest({
          method,
          url: config.url,
          data: config.data ? JSON.parse(config.data) : undefined,
          label: `${method.toUpperCase()} ${config.url}`,
        });

        // Return a synthetic "queued" response so callers don't crash
        return {
          data: {
            _offlineQueued: true,
            message: "Request saved offline. It will sync when you reconnect.",
          },
          status: 0,
          statusText: "Queued Offline",
          headers: {},
          config,
        };
      } catch (queueError) {
        console.error("Failed to queue offline request:", queueError);
      }
    }

    return Promise.reject(error);
  }
);

import axios from "axios";
import { getStoredAuth } from "./authService";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";

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

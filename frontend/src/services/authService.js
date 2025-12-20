import { apiClient } from "./api";

const AUTH_STORAGE_KEY = "disaster_response_auth";

/**
 * Get stored auth data from localStorage
 */
export const getStoredAuth = () => {
  try {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!stored) return null;

    const authData = JSON.parse(stored);

    // Check if session has expired locally
    if (authData.sessionExpires && Date.now() > authData.sessionExpires) {
      clearAuth();
      return null;
    }

    return authData;
  } catch {
    return null;
  }
};

/**
 * Store auth data in localStorage
 */
export const storeAuth = (authData) => {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authData));
};

/**
 * Clear stored auth data
 */
export const clearAuth = () => {
  localStorage.removeItem(AUTH_STORAGE_KEY);
};

/**
 * Check server session status
 */
export const checkSession = async () => {
  try {
    const response = await apiClient.get("/auth/session");
    if (response.data.success && response.data.authenticated) {
      const userData = response.data.data;
      storeAuth(userData);
      apiClient.defaults.headers.common["x-auth-pin"] = userData.pin;
      return { authenticated: true, user: userData };
    }
    return { authenticated: false };
  } catch {
    return { authenticated: false };
  }
};

/**
 * Login with 4-digit PIN
 */
export const loginWithPin = async (pin) => {
  const response = await apiClient.post("/auth/login", { pin });
  if (response.data.success) {
    storeAuth(response.data.data);
    // Set default header for future requests
    apiClient.defaults.headers.common["x-auth-pin"] = pin;
  }
  return response.data;
};

/**
 * Logout - clear stored auth and destroy server session
 */
export const logout = async () => {
  try {
    await apiClient.post("/auth/logout");
  } catch (error) {
    console.error("Logout request failed:", error);
  }
  clearAuth();
  delete apiClient.defaults.headers.common["x-auth-pin"];
};

/**
 * Get current user info
 */
export const getCurrentUser = async () => {
  const auth = getStoredAuth();
  if (!auth?.pin) {
    throw new Error("Not authenticated");
  }

  apiClient.defaults.headers.common["x-auth-pin"] = auth.pin;
  const response = await apiClient.get("/auth/me");
  return response.data;
};

/**
 * Register a new volunteer (managers only)
 */
export const registerVolunteer = async (volunteerData) => {
  const response = await apiClient.post("/auth/register", volunteerData);
  return response.data;
};

/**
 * Get all volunteers (managers only)
 */
export const getVolunteers = async () => {
  const response = await apiClient.get("/auth/volunteers");
  return response.data;
};

/**
 * Deactivate a volunteer (managers only)
 */
export const deactivateVolunteer = async (id) => {
  const response = await apiClient.delete(`/auth/volunteers/${id}`);
  return response.data;
};

/**
 * Initialize auth from stored data
 */
export const initializeAuth = () => {
  const auth = getStoredAuth();
  if (auth?.pin) {
    apiClient.defaults.headers.common["x-auth-pin"] = auth.pin;
    return auth;
  }
  return null;
};

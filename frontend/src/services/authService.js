import { apiClient } from "./api";

const AUTH_STORAGE_KEY = "disaster_response_auth";

/**
 * Get stored auth data from localStorage
 */
export const getStoredAuth = () => {
  try {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
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
 * Logout - clear stored auth
 */
export const logout = () => {
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

/**
 * Check if user has a specific role
 */
export const hasRole = (requiredRole) => {
  const auth = getStoredAuth();
  if (!auth) return false;

  if (requiredRole === "manager") {
    return auth.role === "manager";
  }

  // Volunteers and managers can access volunteer features
  return ["volunteer", "manager"].includes(auth.role);
};

/**
 * Check if user is a manager
 */
export const isManager = () => hasRole("manager");

/**
 * Check if user is authenticated
 */
export const isAuthenticated = () => {
  const auth = getStoredAuth();
  return !!auth?.pin;
};

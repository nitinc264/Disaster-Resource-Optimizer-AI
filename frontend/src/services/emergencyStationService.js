import { apiClient } from "./api";

/**
 * Emergency Station API Service
 * Handles all emergency station and alert related API calls
 */

// ============================================================================
// EMERGENCY STATIONS
// ============================================================================

/**
 * Get all registered emergency stations
 */
export async function getAllStations(filters = {}) {
  const params = new URLSearchParams();
  if (filters.type) params.append("type", filters.type);
  if (filters.status) params.append("status", filters.status);

  const response = await apiClient.get(`/emergency-stations?${params}`);
  return response.data;
}

/**
 * Register a new emergency station
 */
export async function registerStation(stationData) {
  const response = await apiClient.post("/emergency-stations", stationData);
  return response.data;
}

/**
 * Delete an emergency station
 */
export async function deleteStation(stationId) {
  const response = await apiClient.delete(`/emergency-stations/${stationId}`);
  return response.data;
}

/**
 * Ping a station to check if it's online
 */
export async function pingStation(stationId) {
  const response = await apiClient.post(
    `/emergency-stations/${stationId}/ping`,
  );
  return response.data;
}

// ============================================================================
// EMERGENCY ALERTS
// ============================================================================

/**
 * Get all emergency alerts
 */
export async function getAllAlerts(filters = {}) {
  const params = new URLSearchParams();
  if (filters.status) params.append("status", filters.status);
  if (filters.emergencyType)
    params.append("emergencyType", filters.emergencyType);
  if (filters.limit) params.append("limit", filters.limit);

  const response = await apiClient.get(`/emergency-stations/alerts?${params}`);
  return response.data;
}

/**
 * Manually dispatch an emergency alert
 */
export async function dispatchAlert(alertData) {
  const response = await apiClient.post(
    "/emergency-stations/alerts/dispatch",
    alertData,
  );
  return response.data;
}

/**
 * Update alert status
 */
export async function updateAlertStatus(alertId, status) {
  const response = await apiClient.put(
    `/emergency-stations/alerts/${alertId}/status`,
    { status },
  );
  return response.data;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get station type display info
 */
export function getStationTypeInfo(type) {
  const types = {
    fire: {
      label: "Fire Station",
      emoji: "🚒",
      color: "#f97316",
      bgColor: "rgba(249, 115, 22, 0.1)",
    },
    hospital: {
      label: "Hospital",
      emoji: "🏥",
      color: "#ef4444",
      bgColor: "rgba(239, 68, 68, 0.1)",
    },
    police: {
      label: "Police Station",
      emoji: "🚔",
      color: "#3b82f6",
      bgColor: "rgba(59, 130, 246, 0.1)",
    },
    rescue: {
      label: "Rescue Team",
      emoji: "🚑",
      color: "#10b981",
      bgColor: "rgba(16, 185, 129, 0.1)",
    },
    ambulance: {
      label: "Ambulance Service",
      emoji: "🚑",
      color: "#ef4444",
      bgColor: "rgba(239, 68, 68, 0.1)",
    },
    coast_guard: {
      label: "Coast Guard",
      emoji: "⚓",
      color: "#0ea5e9",
      bgColor: "rgba(14, 165, 233, 0.1)",
    },
  };

  return (
    types[type] || {
      label: type,
      emoji: "🏢",
      color: "#6b7280",
      bgColor: "rgba(107, 114, 128, 0.1)",
    }
  );
}

/**
 * Get emergency type display info
 */
export function getEmergencyTypeInfo(type) {
  const types = {
    fire: { label: "Fire", emoji: "🔥", color: "#f97316" },
    flood: { label: "Flood", emoji: "🌊", color: "#3b82f6" },
    earthquake: { label: "Earthquake", emoji: "🌍", color: "#8b5cf6" },
    medical: { label: "Medical", emoji: "🏥", color: "#ef4444" },
    rescue: { label: "Rescue", emoji: "🆘", color: "#10b981" },
    traffic_accident: {
      label: "Traffic Accident",
      emoji: "🚗",
      color: "#f59e0b",
    },
    hazmat: { label: "Hazmat", emoji: "☢️", color: "#eab308" },
    building_collapse: {
      label: "Building Collapse",
      emoji: "🏚️",
      color: "#6b7280",
    },
    landslide: { label: "Landslide", emoji: "⛰️", color: "#78716c" },
    storm: { label: "Storm", emoji: "🌪️", color: "#0ea5e9" },
    general: { label: "General", emoji: "⚠️", color: "#6b7280" },
  };

  return (
    types[type] || {
      label: type,
      emoji: "⚠️",
      color: "#6b7280",
    }
  );
}

/**
 * Get severity level info
 */
export function getSeverityInfo(severity) {
  if (severity >= 8) {
    return {
      label: "Critical",
      color: "#ef4444",
      bgColor: "rgba(239, 68, 68, 0.2)",
    };
  } else if (severity >= 6) {
    return {
      label: "High",
      color: "#f97316",
      bgColor: "rgba(249, 115, 22, 0.2)",
    };
  } else if (severity >= 4) {
    return {
      label: "Medium",
      color: "#f59e0b",
      bgColor: "rgba(245, 158, 11, 0.2)",
    };
  } else {
    return {
      label: "Low",
      color: "#10b981",
      bgColor: "rgba(16, 185, 129, 0.2)",
    };
  }
}

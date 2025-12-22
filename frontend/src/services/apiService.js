import { apiClient } from "./api";

/**
 * Fetch all unverified tasks from the backend
 * @returns {Promise<Array>} Array of unverified tasks
 */
export async function getUnverifiedTasks() {
  try {
    const response = await apiClient.get("/tasks/unverified");
    return response.data.data || [];
  } catch (error) {
    console.error("Error fetching unverified tasks:", error);
    throw error;
  }
}

/**
 * Submit a verification for a task
 * @param {string|number} taskId - The ID of the task to verify
 * @param {string} volunteerNotes - Notes from the volunteer about the verification
 * @returns {Promise<Object>} Response from the backend
 */
export async function postVerification(taskId, volunteerNotes) {
  try {
    const response = await apiClient.post("/tasks/verify", {
      taskId,
      volunteerNotes,
    });
    return response.data;
  } catch (error) {
    console.error("Error posting verification:", error);
    throw error;
  }
}

/**
 * Fetch all needs that have coordinates for the dashboard map
 */
export async function getNeedsForMap() {
  try {
    const response = await apiClient.get("/needs/map");
    return response.data.data || [];
  } catch (error) {
    console.error("Error fetching needs for map:", error);
    throw error;
  }
}

/**
 * Fetch all reports from the backend
 * @param {Object} options - Query options
 * @param {string} options.status - Filter by status (optional)
 * @param {number} options.limit - Limit number of results (optional)
 * @returns {Promise<Array>} Array of reports
 */
export async function getReports(options = {}) {
  try {
    const params = new URLSearchParams();
    if (options.status) params.append("status", options.status);
    if (options.limit) params.append("limit", options.limit);

    const queryString = params.toString();
    const url = queryString ? `/reports?${queryString}` : "/reports";

    const response = await apiClient.get(url);
    return response.data.data || [];
  } catch (error) {
    console.error("Error fetching reports:", error);
    throw error;
  }
}

/**
 * Fetch all active missions
 * @returns {Promise<Array>} Array of missions with routes
 */
export async function getMissions() {
  try {
    const response = await apiClient.get("/missions");
    return response.data.data || [];
  } catch (error) {
    console.error("Error fetching missions:", error);
    throw error;
  }
}

/**
 * Mark a mission as complete
 * @param {string} missionId - The ID of the mission to complete
 * @returns {Promise<Object>} Response from the backend
 */
export async function completeMission(missionId) {
  try {
    const response = await apiClient.patch(`/missions/${missionId}/complete`);
    return response.data;
  } catch (error) {
    console.error("Error completing mission:", error);
    throw error;
  }
}

/**
 * Re-route a mission to a different station
 * @param {string} missionId - The ID of the mission to re-route
 * @param {Object} station - The new station { type, name, lat, lon }
 * @returns {Promise<Object>} Response from the backend
 */
export async function rerouteMission(missionId, station) {
  try {
    const response = await apiClient.patch(`/missions/${missionId}/reroute`, {
      station,
    });
    return response.data;
  } catch (error) {
    console.error("Error re-routing mission:", error);
    throw error;
  }
}

// ============================================
// Resource Tracking API
// ============================================

/**
 * Fetch resource stations and their availability
 * @returns {Promise<Array>} Array of resource stations
 */
export async function getResourceStations() {
  try {
    const response = await apiClient.get("/resources/stations");
    return response.data.data || [];
  } catch (error) {
    console.error("Error fetching resource stations:", error);
    throw error;
  }
}

/**
 * Update resource availability for a station
 * @param {string} stationId - The station ID
 * @param {Object} updates - Resource updates
 * @returns {Promise<Object>} Updated station data
 */
export async function updateResourceAvailability(stationId, updates) {
  try {
    const response = await apiClient.patch(
      `/resources/stations/${stationId}`,
      updates
    );
    return response.data;
  } catch (error) {
    console.error("Error updating resources:", error);
    throw error;
  }
}

// ============================================
// Analytics API
// ============================================

/**
 * Fetch analytics data
 * @param {Object} options - Query options
 * @param {string} options.timeRange - Time range filter (today, week, month, all)
 * @returns {Promise<Object>} Analytics data
 */
export async function getAnalytics(options = {}) {
  try {
    const params = new URLSearchParams();
    if (options.timeRange) params.append("timeRange", options.timeRange);

    const queryString = params.toString();
    const url = queryString ? `/analytics?${queryString}` : "/analytics";

    const response = await apiClient.get(url);
    return response.data.data || {};
  } catch (error) {
    console.error("Error fetching analytics:", error);
    throw error;
  }
}

// ============================================
// Road Conditions API
// ============================================

/**
 * Get all road conditions with optional status filter
 */
export async function getRoadConditions(options = {}) {
  try {
    const status = options.status || "active";
    const response = await apiClient.get(`/roads?status=${status}`);
    return response.data.data || [];
  } catch (error) {
    console.error("Error fetching road conditions:", error);
    throw error;
  }
}

/**
 * Report a road condition
 */
export async function reportRoadCondition(condition) {
  try {
    const response = await apiClient.post("/roads", condition);
    return response.data.data;
  } catch (error) {
    const message = error?.response?.data?.message || error.message;
    console.error("Error reporting road condition:", message, error?.response?.data);
    throw error;
  }
}

/**
 * Verify a road condition
 */
export async function verifyRoadCondition(
  conditionId,
  verifiedBy = "dashboard"
) {
  try {
    const response = await apiClient.patch(`/roads/${conditionId}/verify`, {
      verifiedBy,
    });
    return response.data.data;
  } catch (error) {
    console.error("Error verifying road condition:", error);
    throw error;
  }
}

/**
 * Update road condition status
 */
export async function updateRoadConditionStatus(conditionId, status) {
  try {
    const response = await apiClient.patch(`/roads/${conditionId}/status`, {
      status,
    });
    return response.data.data;
  } catch (error) {
    console.error("Error updating road condition:", error);
    throw error;
  }
}

// Helper object used by components
export const roadConditionsAPI = {
  getAll: async (options = {}) => ({
    data: { data: await getRoadConditions(options) },
  }),
  create: (payload) => reportRoadCondition(payload),
  verify: (id, verifiedBy = "dashboard") => verifyRoadCondition(id, verifiedBy),
  resolve: (id) => updateRoadConditionStatus(id, "cleared"),
};

// ============================================
// Missing Persons API
// ============================================

/**
 * Get all missing persons (supports status and search)
 */
export async function getMissingPersons(options = {}) {
  try {
    const params = new URLSearchParams();
    const status = options.status || "missing";
    if (status) params.append("status", status);
    if (options.search) params.append("search", options.search);

    const queryString = params.toString();
    const url = queryString
      ? `/missing-persons?${queryString}`
      : "/missing-persons";

    const response = await apiClient.get(url);
    return response.data.data || [];
  } catch (error) {
    console.error("Error fetching missing persons:", error);
    throw error;
  }
}

/**
 * Report a missing person (supports photo upload)
 * @param {Object|FormData} data - Person data or FormData with photo
 */
export async function reportMissingPerson(data) {
  try {
    // Check if data is FormData (has photo)
    const isFormData = data instanceof FormData;
    const response = await apiClient.post("/missing-persons", data, {
      headers: isFormData ? { "Content-Type": "multipart/form-data" } : {},
    });
    return response.data.data;
  } catch (error) {
    console.error("Error reporting missing person:", error);
    throw error;
  }
}

/**
 * Mark a missing person as found
 */
export async function markPersonFound(caseId, foundInfo) {
  try {
    const response = await apiClient.patch(
      `/missing-persons/${caseId}/found`,
      foundInfo
    );
    return response.data.data;
  } catch (error) {
    console.error("Error marking person as found:", error);
    throw error;
  }
}

/**
 * Mark a missing person as reunited
 */
export async function markPersonReunited(caseId) {
  try {
    const response = await apiClient.patch(
      `/missing-persons/${caseId}/reunited`
    );
    return response.data.data;
  } catch (error) {
    console.error("Error marking person as reunited:", error);
    throw error;
  }
}

/**
 * Get missing persons statistics
 */
export async function getMissingPersonsStats() {
  try {
    const response = await apiClient.get("/missing-persons/stats");
    return response.data.data;
  } catch (error) {
    console.error("Error fetching stats:", error);
    throw error;
  }
}

// Helper object used by components
export const missingPersonsAPI = {
  getAll: async (options = {}) => ({
    data: { data: await getMissingPersons(options) },
  }),
  create: (payload) => reportMissingPerson(payload),
  // Alias for volunteer-facing forms that submit missing person reports
  report: (payload) => reportMissingPerson(payload),
  updateStatus: (id, status) => {
    if (status === "found") {
      return markPersonFound(id, { foundBy: "dashboard" });
    }
    if (status === "reunited") {
      return markPersonReunited(id);
    }
    // Fallback: no-op to keep promise chain
    return Promise.resolve();
  },
};

// ============================================
// Shelter Management API
// ============================================

/**
 * Get all shelters
 */
export async function getShelters(options = {}) {
  try {
    const params = new URLSearchParams();
    if (options.status) params.append("status", options.status);
    if (options.hasCapacity) params.append("hasCapacity", options.hasCapacity);

    const queryString = params.toString();
    const url = queryString ? `/shelters?${queryString}` : "/shelters";

    const response = await apiClient.get(url);
    return response.data.data || [];
  } catch (error) {
    console.error("Error fetching shelters:", error);
    throw error;
  }
}

/**
 * Create a new shelter
 */
export async function createShelter(shelter) {
  try {
    const response = await apiClient.post("/shelters", shelter);
    return response.data.data;
  } catch (error) {
    console.error("Error creating shelter:", error);
    throw error;
  }
}

/**
 * Update shelter capacity
 */
export async function updateShelterCapacity(shelterId, capacity) {
  try {
    const response = await apiClient.patch(
      `/shelters/${shelterId}/capacity`,
      capacity
    );
    return response.data.data;
  } catch (error) {
    console.error("Error updating capacity:", error);
    throw error;
  }
}

/**
 * Update shelter supplies
 */
export async function updateShelterSupplies(shelterId, supplies) {
  try {
    const response = await apiClient.patch(
      `/shelters/${shelterId}/supplies`,
      supplies
    );
    return response.data.data;
  } catch (error) {
    console.error("Error updating supplies:", error);
    throw error;
  }
}

// Helper object used by components
export const sheltersAPI = {
  getAll: async (options = {}) => ({
    data: { data: await getShelters(options) },
  }),
  create: (payload) => createShelter(payload),
  update: (id, data) => {
    if (data?.capacity) {
      return updateShelterCapacity(id, data.capacity);
    }
    if (data?.supplies) {
      return updateShelterSupplies(id, data.supplies);
    }
    // Fallback to generic patch if extra fields are provided
    return apiClient
      .patch(`/shelters/${id}`, data)
      .then((res) => res.data.data);
  },
};

// ============================================
// Route Calculation API
// ============================================

/**
 * Calculate a volunteer route from origin to destination
 * Uses centralized backend routing service (OSRM)
 * @param {Object} origin - Starting point {lat, lon/lng}
 * @param {Object} destination - Destination point {lat, lon/lng}
 * @returns {Promise<Object>} Route data with geometry, distance, duration
 */
export async function getVolunteerRoute(origin, destination) {
  try {
    const response = await apiClient.post("/routes/volunteer", {
      origin,
      destination,
    });
    return response.data.data;
  } catch (error) {
    console.error("Error calculating volunteer route:", error);
    throw error;
  }
}

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

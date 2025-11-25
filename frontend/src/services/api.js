import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";

// Set up a base URL for your backend API
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

/**
 * Calls the backend to get the optimized route.
 * @param {object} payload - The object { depot: {lat, lon}, stops: [{lat, lon}] }
 * @returns {Promise<object>} The response data, e.g., { optimized_route: [...] }
 */
export const optimizeRoute = async (payload) => {
  try {
    const response = await apiClient.post("/optimize-route", payload);
    return response.data; // This will be the OptimizeResponse model
  } catch (error) {
    console.error(
      "Error in optimizeRoute API call:",
      error.response?.data || error.message
    );
    throw error.response?.data || new Error("Network error");
  }
};

// You can add other API functions here as needed

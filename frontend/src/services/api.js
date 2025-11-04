// # **[Part 3] Has `optimizeRoute()` func to call backend**
// Aegis AI/frontend/src/services/api.js

import axios from 'axios';

// Set up a base URL for your backend API
const apiClient = axios.create({
    baseURL: 'http://localhost:8000', // Assuming your FastAPI runs on port 8000
    headers: {
        'Content-Type': 'application/json'
    }
});

/**
 * Calls the backend to get the optimized route.
 * @param {object} payload - The object { depot: {lat, lon}, stops: [{lat, lon}] }
 * @returns {Promise<object>} The response data, e.g., { optimized_route: [...] }
 */
export const optimizeRoute = async (payload) => {
    try {
        const response = await apiClient.post('/api/optimize-route', payload);
        return response.data; // This will be the OptimizeResponse model
    } catch (error) {
        console.error("Error in optimizeRoute API call:", error.response?.data || error.message);
        throw error.response?.data || new Error("Network error");
    }
};

// You can add other API functions here as needed
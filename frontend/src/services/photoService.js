import { apiClient } from "./api";

/**
 * Upload a photo-based report to the backend
 * @param {File} imageFile - Captured image file
 * @param {{lat: number, lng: number}} location - User location (optional)
 * @param {string} message - Optional caption/description
 * @returns {Promise<Object>} Backend response payload
 */
// Default location: Pune city center (used when geolocation is unavailable)
const DEFAULT_LOCATION = {
  lat: 18.5204,
  lng: 73.8567,
};

export async function uploadPhotoReport(imageFile, location, message = "") {
  const formData = new FormData();

  formData.append("image", imageFile);
  // Use provided location, or fall back to Pune city center if unavailable
  // Avoid using 0,0 as it places markers in the Atlantic Ocean
  const hasValidLocation = location && 
    typeof location.lat === 'number' && 
    typeof location.lng === 'number' &&
    !(location.lat === 0 && location.lng === 0);
  
  const lat = hasValidLocation ? location.lat : DEFAULT_LOCATION.lat;
  const lng = hasValidLocation ? location.lng : DEFAULT_LOCATION.lng;
  formData.append("lat", lat.toString());
  formData.append("lng", lng.toString());
  formData.append("usedDefaultLocation", (!hasValidLocation).toString());

  if (message) {
    formData.append("message", message);
  }

  try {
    const response = await apiClient.post("/reports/photo", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
      timeout: 30000,
    });

    return response.data;
  } catch (error) {
    if (error.response) {
      throw new Error(
        error.response.data?.message ||
          error.response.data?.error ||
          "Server failed to accept the photo"
      );
    }

    if (error.request) {
      throw new Error("No response from server. Check your connection.");
    }

    throw new Error(error.message || "Failed to upload photo report");
  }
}

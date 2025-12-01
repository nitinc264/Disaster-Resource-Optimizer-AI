import { apiClient } from "./api";

/**
 * Upload a photo-based report to the backend
 * @param {File} imageFile - Captured image file
 * @param {{lat: number, lng: number}} location - User location
 * @param {string} message - Optional caption/description
 * @returns {Promise<Object>} Backend response payload
 */
export async function uploadPhotoReport(imageFile, location, message = "") {
  const formData = new FormData();

  formData.append("image", imageFile);
  formData.append("lat", location.lat.toString());
  formData.append("lng", location.lng.toString());

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

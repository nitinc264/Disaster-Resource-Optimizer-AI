import { apiClient } from "./api";

/**
 * Upload audio file to backend for transcription and analysis
 * @param {Blob} audioBlob - The audio blob to upload
 * @param {Object} location - Location object with lat and lng properties (optional)
 * @returns {Promise<Object>} Response from backend with transcription and analysis
 */
export async function uploadAudioReport(audioBlob, location) {
  try {
    // Create FormData for multipart upload
    const formData = new FormData();

    // Append audio file with proper filename
    const audioFile = new File([audioBlob], `audio-report-${Date.now()}.webm`, {
      type: audioBlob.type || "audio/webm",
    });
    formData.append("audio", audioFile);

    // Append location data - use Pune default if not provided (avoid 0,0 which maps to the Atlantic Ocean)
    const DEFAULT_LAT = 18.5204;
    const DEFAULT_LNG = 73.8567;
    const lat =
      location?.lat &&
      location?.lng &&
      !(location.lat === 0 && location.lng === 0)
        ? location.lat
        : DEFAULT_LAT;
    const lng =
      location?.lat &&
      location?.lng &&
      !(location.lat === 0 && location.lng === 0)
        ? location.lng
        : DEFAULT_LNG;
    formData.append("lat", lat.toString());
    formData.append("lng", lng.toString());

    // Send POST request to backend
    const response = await apiClient.post("/reports/audio", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
      timeout: 60000, // 60 second timeout for transcription
    });

    return response.data;
  } catch (error) {
    console.error("Error uploading audio report:", error);

    if (error.response) {
      // Server responded with error
      throw new Error(
        error.response.data?.message ||
          `Server error: ${error.response.status}`,
      );
    } else if (error.request) {
      // Request made but no response
      throw new Error("No response from server. Please check your connection.");
    } else {
      // Other errors
      throw new Error(error.message || "Failed to upload audio report");
    }
  }
}

/**
 * Get current location using browser geolocation API
 * @returns {Promise<Object>} Location object with lat and lng
 */
export async function getCurrentLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported by your browser"));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
      },
      (error) => {
        let errorMessage = "Failed to get location";

        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage =
              "Location permission denied. Please enable location access.";
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = "Location information is unavailable.";
            break;
          case error.TIMEOUT:
            errorMessage = "Location request timed out.";
            break;
          default:
            errorMessage = "An unknown error occurred while getting location.";
        }

        reject(new Error(errorMessage));
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        // Allow cached location up to 5 minutes old (helps when offline)
        maximumAge: 300000,
      },
    );
  });
}

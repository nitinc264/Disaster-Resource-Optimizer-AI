/**
 * Application-wide constants
 */

// Status values for needs/reports
export const STATUS = {
  UNVERIFIED: "Unverified",
  VERIFIED: "Verified",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
};

// HTTP status codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500,
};

// Geocoding defaults
export const GEOCODE_DEFAULTS = {
  REGION: "Pune, India",
  TIMEOUT: 5000,
  // Default location (Pune city center) for needs without geocoded coordinates
  DEFAULT_LAT: 18.5204,
  DEFAULT_LON: 73.8567,
};

// AI Model configurations
export const AI_MODELS = {
  GEMINI: "gemini-2.5-flash",
  WHISPER: "whisper-1",
};

// Environment types
export const ENVIRONMENTS = {
  DEVELOPMENT: "development",
  PRODUCTION: "production",
  TEST: "test",
};

export default {
  STATUS,
  HTTP_STATUS,
  GEOCODE_DEFAULTS,
  AI_MODELS,
  ENVIRONMENTS,
};

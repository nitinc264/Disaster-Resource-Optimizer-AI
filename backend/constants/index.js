/**
 * Application-wide constants
 */

// Need types for disaster response
export const NEED_TYPES = {
  WATER: "Water",
  FOOD: "Food",
  MEDICAL: "Medical",
  RESCUE: "Rescue",
  OTHER: "Other",
};

// Urgency levels
export const URGENCY_LEVELS = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
};

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
};

// AI Model configurations
export const AI_MODELS = {
  GEMINI: "gemini-2.5-flash",
  WHISPER: "whisper-1",
};

// File upload constraints
export const UPLOAD_CONSTRAINTS = {
  MAX_FILE_SIZE: 25 * 1024 * 1024, // 25MB
  ALLOWED_AUDIO_TYPES: ["audio/mpeg", "audio/wav", "audio/ogg", "audio/webm"],
};

// Environment types
export const ENVIRONMENTS = {
  DEVELOPMENT: "development",
  PRODUCTION: "production",
  TEST: "test",
};

export default {
  NEED_TYPES,
  URGENCY_LEVELS,
  STATUS,
  HTTP_STATUS,
  GEOCODE_DEFAULTS,
  AI_MODELS,
  UPLOAD_CONSTRAINTS,
  ENVIRONMENTS,
};

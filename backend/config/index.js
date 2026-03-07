import dotenv from "dotenv";
import { getEnvironmentConfig } from "./envSettings.js";
import { GEOCODE_DEFAULTS } from "../constants/index.js";

// Load environment variables
dotenv.config();

// Get environment-specific configuration
const envConfig = getEnvironmentConfig();

/**
 * Centralized application configuration
 * Combines environment variables with environment-specific settings
 */
const isProd = (process.env.NODE_ENV || "development") === "production";

// Fail fast if critical env vars are missing in production
if (isProd) {
  const required = ["MONGO_URI", "SESSION_SECRET", "ALLOWED_ORIGINS"];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error(`FATAL: Missing required environment variables in production: ${missing.join(", ")}`);
    process.exit(1);
  }
}

export const config = {
  // Environment
  nodeEnv: process.env.NODE_ENV || "development",

  // Server
  port: envConfig.port,

  // Database
  mongoUri: envConfig.mongoUri,

  // CORS
  cors: envConfig.cors,

  // Logging
  logging: envConfig.logging,

  // API Keys
  geminiApiKey: process.env.GEMINI_API_KEY,
  openaiApiKey: process.env.OPENAI_API_KEY,

  // Twilio
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    validateWebhook: process.env.NODE_ENV === "production",
  },

  // Geocoding
  geocode: {
    defaultRegion:
      process.env.GEOCODE_DEFAULT_REGION || GEOCODE_DEFAULTS.REGION,
    timeout: GEOCODE_DEFAULTS.TIMEOUT,
  },
};

export default config;

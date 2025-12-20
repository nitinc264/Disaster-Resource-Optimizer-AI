import { ENVIRONMENTS } from "../constants/index.js";

/**
 * Development environment configuration
 */
export const development = {
  port: 3000,
  mongoUri:
    process.env.MONGO_URI || "mongodb://localhost:27017/DisasterResponseDB",
  cors: {
    origin: "*",
    credentials: true,
  },
  logging: {
    level: "debug",
    requests: true,
  },
};

/**
 * Production environment configuration
 */
export const production = {
  port: process.env.PORT || 3000,
  mongoUri: process.env.MONGO_URI,
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(",") || [],
    credentials: true,
  },
  logging: {
    level: "error",
    requests: false,
  },
};

/**
 * Test environment configuration
 */
export const test = {
  port: 3001,
  mongoUri:
    process.env.MONGO_URI ||
    "mongodb://localhost:27017/DisasterResponseDB-test",
  cors: {
    origin: "*",
    credentials: true,
  },
  logging: {
    level: "error",
    requests: false,
  },
};

/**
 * Get environment-specific configuration
 */
export function getEnvironmentConfig() {
  const env = process.env.NODE_ENV || ENVIRONMENTS.DEVELOPMENT;

  const configs = {
    [ENVIRONMENTS.DEVELOPMENT]: development,
    [ENVIRONMENTS.PRODUCTION]: production,
    [ENVIRONMENTS.TEST]: test,
  };

  return configs[env] || development;
}

export default {
  development,
  production,
  test,
  getEnvironmentConfig,
};

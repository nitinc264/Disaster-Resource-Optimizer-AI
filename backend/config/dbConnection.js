import mongoose from "mongoose";
import { logger } from "../utils/appLogger.js";

/**
 * Connect to MongoDB database
 * @param {string} uri - MongoDB connection URI
 * @returns {Promise<void>}
 */
export async function connectDatabase(uri) {
  if (!uri) {
    throw new Error("MongoDB URI is required");
  }

  try {
    await mongoose.connect(uri);
    logger.info("MongoDB Connected successfully");

    // Handle connection events
    mongoose.connection.on("error", (err) => {
      logger.error("MongoDB connection error:", err);
    });

    mongoose.connection.on("disconnected", () => {
      logger.warn("MongoDB disconnected");
    });

    mongoose.connection.on("reconnected", () => {
      logger.info("MongoDB reconnected");
    });
  } catch (err) {
    logger.error("MongoDB Connection Error:", err);
    throw err;
  }
}

/**
 * Disconnect from MongoDB database
 * @returns {Promise<void>}
 */
export async function disconnectDatabase() {
  try {
    await mongoose.disconnect();
    logger.info("MongoDB Disconnected");
  } catch (err) {
    logger.error("MongoDB Disconnection Error:", err);
    throw err;
  }
}

export default { connectDatabase, disconnectDatabase };

import mongoose from "mongoose";
import dotenv from "dotenv";
import { config } from "../config/index.js";
import { connectDatabase } from "../config/dbConnection.js";

dotenv.config();

const CONFIRM_FLAG = "--confirm";
const shouldProceed =
  process.argv.includes(CONFIRM_FLAG) ||
  process.env.DB_CLEAR_CONFIRM === "true";

async function clearDatabase() {
  if (!shouldProceed) {
    console.error(
      `Database wipe aborted. Pass ${CONFIRM_FLAG} or set DB_CLEAR_CONFIRM=true to proceed.`
    );
    process.exit(1);
  }

  const mongoUri = config.mongoUri;

  if (!mongoUri) {
    console.error("Missing MONGO_URI. Cannot connect to database.");
    process.exit(1);
  }

  try {
    await connectDatabase(mongoUri);
    const db = mongoose.connection.db;
    const collections = await db.collections();

    if (collections.length === 0) {
      console.log("No collections found. Nothing to clear.");
    } else {
      for (const collection of collections) {
        const count = await collection.countDocuments();
        await collection.deleteMany({});
        console.log(
          `Cleared ${count} documents from ${collection.collectionName}`
        );
      }

      console.log("Database cleared successfully.");
    }
  } catch (error) {
    console.error("Failed to clear database:", error);
    process.exitCode = 1;
  }

  try {
    await mongoose.disconnect();
  } catch (disconnectError) {
    console.error(
      "Failed to close MongoDB connection cleanly:",
      disconnectError
    );
  }
}

clearDatabase();

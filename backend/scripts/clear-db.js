import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import User from "../models/UserModel.js";

// Load environment variables from backend/.env
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../.env") });

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

  // Use the same MONGO_URI as the server
  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    console.error("Missing MONGO_URI. Cannot connect to database.");
    process.exit(1);
  }

  try {
    console.log(`Connecting to: ${mongoUri}`);
    await mongoose.connect(mongoUri);
    console.log("MongoDB Connected successfully");

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

    // Create default users
    console.log("\nCreating default users...");

    const defaultManager = await User.create({
      pin: "0000",
      name: "Default Manager",
      role: "manager",
      email: "manager@disaster-response.local",
      isActive: true,
    });
    console.log(
      `✅ Created manager with PIN: 0000 (ID: ${defaultManager._id})`
    );

    const defaultVolunteer = await User.create({
      pin: "9204",
      name: "Default Volunteer",
      role: "volunteer",
      email: "volunteer@disaster-response.local",
      isActive: true,
    });
    console.log(
      `✅ Created volunteer with PIN: 9204 (ID: ${defaultVolunteer._id})`
    );

    console.log("\n✨ Database reset complete with default users!");
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

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
    console.log("MongoDB Connected successfully\n");

    const db = mongoose.connection.db;
    const collections = await db.collections();

    if (collections.length === 0) {
      console.log("No collections found. Nothing to clear.");
    } else {
      // First, show what data exists
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log("📊 CURRENT DATABASE STATE");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

      let totalDocuments = 0;
      const collectionStats = [];

      for (const collection of collections) {
        const count = await collection.countDocuments();
        totalDocuments += count;
        if (count > 0) {
          collectionStats.push({ name: collection.collectionName, count });
        }
      }

      if (totalDocuments === 0) {
        console.log("✓ Database is already empty\n");
      } else {
        collectionStats.forEach(({ name, count }) => {
          console.log(
            `  ${name.padEnd(25)} : ${count.toLocaleString()} document(s)`
          );
        });
        console.log(
          `\n  ${"TOTAL".padEnd(
            25
          )} : ${totalDocuments.toLocaleString()} documents across ${
            collectionStats.length
          } collections\n`
        );

        // Now clear the database
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log("🗑️  CLEARING DATABASE");
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

        for (const { name, count } of collectionStats) {
          const collection = db.collection(name);
          await collection.deleteMany({});
          console.log(
            `  ✓ Cleared ${count.toLocaleString()} document(s) from '${name}'`
          );
        }

        console.log(
          `\n✅ Successfully removed ${totalDocuments.toLocaleString()} total documents!\n`
        );
      }
    }

    // Create default users
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("� CREATING DEFAULT USERS");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    const defaultManager = await User.create({
      pin: "0000",
      name: "Default Manager",
      role: "manager",
      email: "manager@disaster-response.local",
      isActive: true,
    });
    console.log(`  ✅ Manager Account Created`);
    console.log(`     Name : ${defaultManager.name}`);
    console.log(`     PIN  : 0000`);
    console.log(`     Role : manager`);
    console.log(`     ID   : ${defaultManager._id}\n`);

    const defaultVolunteer = await User.create({
      pin: "9204",
      name: "Default Volunteer",
      role: "volunteer",
      email: "volunteer@disaster-response.local",
      isActive: true,
    });
    console.log(`  ✅ Volunteer Account Created`);
    console.log(`     Name : ${defaultVolunteer.name}`);
    console.log(`     PIN  : 9204`);
    console.log(`     Role : volunteer`);
    console.log(`     ID   : ${defaultVolunteer._id}\n`);

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("✨ DATABASE RESET COMPLETE");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    console.log("  Summary:");
    console.log(
      "  • All collections cleared (reports, missions, stations, alerts, needs, etc.)"
    );
    console.log("  • 2 default users created (Manager + Volunteer)");
    console.log("  • System ready for fresh data\n");
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

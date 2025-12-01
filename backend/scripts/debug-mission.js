import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

const MONGODB_URI =
  process.env.MONGO_URI || "mongodb://localhost:27017/DisasterResponseDB";

async function main() {
  await mongoose.connect(MONGODB_URI);
  console.log("Connected to MongoDB");

  // Check all missions
  const missions = await mongoose.connection.db
    .collection("missions")
    .find({})
    .toArray();
  console.log("\n=== MISSIONS ===");
  console.log("Total missions:", missions.length);

  for (const m of missions) {
    console.log("\n--- Mission ---");
    console.log("ID:", m._id.toString());
    console.log("Status:", m.status);
    console.log("Station:", m.station?.name || "N/A");
    console.log("report_ids:", m.report_ids?.length || 0, m.report_ids);
    console.log("need_ids:", m.need_ids?.length || 0, m.need_ids);
  }

  // Check reports
  const reports = await mongoose.connection.db
    .collection("reports")
    .find({})
    .limit(5)
    .toArray();
  console.log("\n=== REPORTS ===");
  console.log("Total reports (showing 5):", reports.length);
  for (const r of reports) {
    console.log(
      "- ID:",
      r._id.toString(),
      "| Status:",
      r.status,
      "| dispatch_status:",
      r.dispatch_status
    );
  }

  // Check needs
  const needs = await mongoose.connection.db
    .collection("needs")
    .find({})
    .limit(5)
    .toArray();
  console.log("\n=== NEEDS ===");
  console.log("Total needs (showing 5):", needs.length);
  for (const n of needs) {
    console.log("- ID:", n._id.toString(), "| Status:", n.status);
  }

  await mongoose.disconnect();
}

main().catch(console.error);

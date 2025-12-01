import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

const uri =
  process.env.MONGODB_URI || "mongodb://localhost:27017/DisasterResponseDB";

async function main() {
  await mongoose.connect(uri);
  console.log("Connected to MongoDB\n");

  // Get recent reports
  const reports = await mongoose.connection.db
    .collection("reports")
    .find({})
    .sort({ createdAt: -1 })
    .limit(10)
    .toArray();

  console.log(`Found ${reports.length} reports:\n`);

  reports.forEach((r) => {
    console.log("─".repeat(50));
    console.log(`ID:       ${r.reportId}`);
    console.log(`Status:   ${r.status}`);
    console.log(`Source:   ${r.source}`);
    console.log(`Text:     ${r.text?.substring(0, 50) || "none"}...`);
    console.log(`Image:    ${r.imageUrl ? "YES" : "no"}`);
    console.log(
      `Sentinel: ${
        r.sentinelData ? JSON.stringify(r.sentinelData) : "not processed"
      }`
    );
    console.log(
      `Oracle:   ${
        r.oracleData ? JSON.stringify(r.oracleData) : "not processed"
      }`
    );
  });

  // Count by status
  console.log("\n" + "═".repeat(50));
  console.log("STATUS SUMMARY:");
  const statuses = await mongoose.connection.db
    .collection("reports")
    .aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }])
    .toArray();

  statuses.forEach((s) => console.log(`  ${s._id}: ${s.count}`));

  // Check missions created by Logistics Agent
  console.log("\n" + "═".repeat(50));
  console.log("MISSIONS (Logistics Agent):");
  const missions = await mongoose.connection.db
    .collection("missions")
    .find({})
    .sort({ timestamp: -1 })
    .toArray();
  console.log(`  Total missions: ${missions.length}`);

  if (missions.length > 0) {
    missions.forEach((m) => {
      console.log(`  ---`);
      console.log(`  Mission: ${m._id}`);
      console.log(`  Status: ${m.status}`);
      console.log(`  Vehicles: ${m.num_vehicles}`);
      if (m.routes) {
        m.routes.forEach((r) => {
          const stops = r.route ? r.route.length - 2 : 0;
          const distKm = (r.total_distance / 1000).toFixed(2);
          console.log(
            `    🚗 Vehicle ${r.vehicle_id}: ${stops} stops, ${distKm} km`
          );
        });
      }
      console.log(`  Reports: ${m.report_ids?.length || 0}`);
    });
  }

  // Check dispatch status
  const assigned = await mongoose.connection.db
    .collection("reports")
    .countDocuments({ dispatch_status: "Assigned" });
  console.log(`\n  Reports dispatched: ${assigned}`);

  await mongoose.disconnect();
}

main().catch(console.error);

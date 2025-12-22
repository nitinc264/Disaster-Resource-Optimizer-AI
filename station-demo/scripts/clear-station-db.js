/**
 * Clear all station-demo databases
 * Run with: node scripts/clear-station-db.js
 */

import mongoose from "mongoose";

const STATION_DBS = [
  { name: "emergency_station_fire", type: "fire", port: 4001 },
  { name: "emergency_station_hospital", type: "hospital", port: 4002 },
  { name: "emergency_station_police", type: "police", port: 4003 },
  { name: "emergency_station_rescue", type: "rescue", port: 4004 },
];

async function clearStationDatabases() {
  console.log("Clearing station databases...\n");

  for (const station of STATION_DBS) {
    try {
      const conn = await mongoose
        .createConnection(`mongodb://localhost:27017/${station.name}`)
        .asPromise();
      const collections = await conn.db.listCollections().toArray();

      console.log(`${station.name} (port ${station.port}):`);

      let totalDeleted = 0;
      for (const col of collections) {
        const count = await conn.db.collection(col.name).countDocuments();
        if (count > 0) {
          await conn.db.collection(col.name).deleteMany({});
          console.log(`  ✓ ${col.name}: ${count} documents deleted`);
          totalDeleted += count;
        }
      }

      if (totalDeleted === 0) {
        console.log("  (empty)");
      }

      await conn.close();
    } catch (err) {
      console.log(`${station.name}: Error - ${err.message}`);
    }
  }

  console.log("\n✅ All station databases cleared!");
  console.log("Restart station-demo servers to see changes.");
  process.exit(0);
}

clearStationDatabases();

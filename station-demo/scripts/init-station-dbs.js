/**
 * Initialize separate databases for each emergency station
 * Run with: node scripts/init-station-dbs.js
 *
 * This creates:
 * - emergency_station_fire (port 4001)
 * - emergency_station_hospital (port 4002)
 * - emergency_station_police (port 4003)
 * - emergency_station_rescue (port 4004)
 */

import mongoose from "mongoose";

const STATION_CONFIGS = [
  {
    dbName: "emergency_station_fire",
    type: "fire",
    port: 4001,
    name: "Fire Station - Central",
    location: { lat: 18.4549, lng: 73.8563 },
  },
  {
    dbName: "emergency_station_hospital",
    type: "hospital",
    port: 4002,
    name: "City General Hospital",
    location: { lat: 18.5135, lng: 73.7604 },
  },
  {
    dbName: "emergency_station_police",
    type: "police",
    port: 4003,
    name: "Police Station - Pimpri",
    location: { lat: 18.6073, lng: 73.7654 },
  },
  {
    dbName: "emergency_station_rescue",
    type: "rescue",
    port: 4004,
    name: "Rescue Team - Shivajinagar",
    location: { lat: 18.5196, lng: 73.8553 },
  },
];

// Alert schema for station databases
const alertSchema = {
  alertId: { type: String, required: true, unique: true },
  emergencyType: { type: String, required: true },
  severity: { type: Number, min: 1, max: 10, default: 5 },
  location: {
    lat: Number,
    lng: Number,
    address: String,
  },
  title: String,
  description: String,
  needs: [String],
  status: {
    type: String,
    enum: [
      "received",
      "acknowledged",
      "dispatched",
      "en_route",
      "on_scene",
      "resolved",
      "rejected",
    ],
    default: "received",
  },
  fromStation: {
    name: String,
    type: String,
  },
  originalTimestamp: Date,
  acknowledgedAt: Date,
  dispatchedAt: Date,
  resolvedAt: Date,
  rejectedAt: Date,
  rejectionReason: String,
  assignedUnits: [
    {
      unitId: String,
      unitName: String,
      assignedAt: Date,
    },
  ],
  notes: [
    {
      text: String,
      createdAt: Date,
    },
  ],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
};

async function initializeStationDatabases() {
  console.log(
    "╔══════════════════════════════════════════════════════════════╗"
  );
  console.log(
    "║     INITIALIZING STATION DATABASES                           ║"
  );
  console.log(
    "╚══════════════════════════════════════════════════════════════╝\n"
  );

  for (const station of STATION_CONFIGS) {
    try {
      console.log(`\n🏢 Setting up: ${station.name}`);
      console.log(`   Database: ${station.dbName}`);
      console.log(`   Port: ${station.port}`);

      // Connect to station database
      const conn = await mongoose
        .createConnection(`mongodb://localhost:27017/${station.dbName}`)
        .asPromise();

      // Create alerts collection with schema validation
      const collections = await conn.db
        .listCollections({ name: "alerts" })
        .toArray();

      if (collections.length === 0) {
        await conn.db.createCollection("alerts");
        console.log(`   ✓ Created 'alerts' collection`);
      } else {
        console.log(`   ✓ 'alerts' collection exists`);
      }

      // Create indexes
      await conn.db
        .collection("alerts")
        .createIndex({ alertId: 1 }, { unique: true });
      await conn.db.collection("alerts").createIndex({ status: 1 });
      await conn.db.collection("alerts").createIndex({ createdAt: -1 });
      await conn.db.collection("alerts").createIndex({ severity: -1 });
      console.log(`   ✓ Created indexes`);

      // Store station config in a settings collection
      await conn.db.collection("settings").updateOne(
        { key: "stationConfig" },
        {
          $set: {
            key: "stationConfig",
            type: station.type,
            name: station.name,
            port: station.port,
            location: station.location,
            updatedAt: new Date(),
          },
        },
        { upsert: true }
      );
      console.log(`   ✓ Stored station configuration`);

      await conn.close();
      console.log(`   ✅ ${station.name} database ready!`);
    } catch (err) {
      console.error(`   ❌ Error setting up ${station.name}:`, err.message);
    }
  }

  console.log(
    "\n════════════════════════════════════════════════════════════════"
  );
  console.log("✅ All station databases initialized!");
  console.log(
    "════════════════════════════════════════════════════════════════"
  );
  console.log("\nTo start stations, run: npm run start:all");
  console.log("\nStation dashboards:");
  STATION_CONFIGS.forEach((s) => {
    console.log(`  ${s.type.padEnd(10)} → http://localhost:${s.port}`);
  });

  process.exit(0);
}

initializeStationDatabases();

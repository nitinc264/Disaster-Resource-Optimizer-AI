/**
 * Seed script to populate ResourceStation collection with realistic
 * disaster-response station data for the Pune area.
 *
 * Usage:
 *   node backend/scripts/seed-resources.js            # adds seed data
 *   node backend/scripts/seed-resources.js --reset     # clears existing & re-seeds
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../.env") });

import ResourceStation from "../models/ResourceStationModel.js";

const STATIONS = [
  {
    stationId: "RS-FIRE-001",
    name: "Pune Central Fire Station",
    type: "fire",
    location: {
      lat: 18.5204,
      lng: 73.8567,
      address: "Shivajinagar, Pune",
    },
    status: "active",
    fleet: [
      { type: "fire_truck", total: 6, available: 4, inUse: 2 },
      { type: "ambulance", total: 3, available: 2, inUse: 1 },
      { type: "rescue_boat", total: 2, available: 2, inUse: 0 },
    ],
    staff: [
      { role: "firefighter", total: 40, available: 28, deployed: 12 },
      { role: "paramedic", total: 8, available: 6, deployed: 2 },
      { role: "driver", total: 10, available: 7, deployed: 3 },
    ],
    supplies: {
      water: { current: 5000, minimum: 2000, maximum: 10000 },
      medical: { current: 120, minimum: 50, maximum: 200 },
      blankets: { current: 300, minimum: 100, maximum: 500 },
      food: { current: 800, minimum: 300, maximum: 1500 },
    },
    contact: { phone: "+91-20-25501234", radio: "FIRE-CH1" },
  },
  {
    stationId: "RS-HOSP-001",
    name: "Sassoon General Hospital",
    type: "hospital",
    location: {
      lat: 18.5128,
      lng: 73.8722,
      address: "Sassoon Road, Pune",
    },
    status: "active",
    fleet: [
      { type: "ambulance", total: 10, available: 6, inUse: 4 },
      { type: "mobile_command", total: 1, available: 1, inUse: 0 },
    ],
    staff: [
      { role: "medical_doctor", total: 15, available: 10, deployed: 5 },
      { role: "paramedic", total: 25, available: 18, deployed: 7 },
      { role: "volunteer", total: 20, available: 14, deployed: 6 },
      { role: "driver", total: 12, available: 8, deployed: 4 },
    ],
    supplies: {
      water: { current: 3000, minimum: 1500, maximum: 8000 },
      medical: { current: 350, minimum: 100, maximum: 500 },
      blankets: { current: 200, minimum: 80, maximum: 400 },
      food: { current: 500, minimum: 200, maximum: 1000 },
    },
    contact: { phone: "+91-20-26127000", radio: "MED-CH3" },
  },
  {
    stationId: "RS-POLICE-001",
    name: "Pune Police Control Room",
    type: "police",
    location: {
      lat: 18.5314,
      lng: 73.8446,
      address: "Deccan Gymkhana, Pune",
    },
    status: "active",
    fleet: [
      { type: "patrol_car", total: 15, available: 10, inUse: 5 },
      { type: "supply_truck", total: 4, available: 3, inUse: 1 },
    ],
    staff: [
      { role: "police_officer", total: 50, available: 35, deployed: 15 },
      { role: "driver", total: 15, available: 10, deployed: 5 },
      { role: "logistics", total: 8, available: 6, deployed: 2 },
    ],
    supplies: {
      water: { current: 2000, minimum: 1000, maximum: 5000 },
      medical: { current: 60, minimum: 30, maximum: 150 },
      blankets: { current: 150, minimum: 50, maximum: 300 },
      food: { current: 400, minimum: 150, maximum: 800 },
    },
    contact: { phone: "+91-20-26126100", radio: "POL-CH5" },
  },
  {
    stationId: "RS-RESCUE-001",
    name: "NDRF Unit Pune",
    type: "rescue",
    location: {
      lat: 18.4655,
      lng: 73.8684,
      address: "Wanowrie, Pune",
    },
    status: "active",
    fleet: [
      { type: "rescue_helicopter", total: 2, available: 1, inUse: 1 },
      { type: "rescue_boat", total: 4, available: 3, inUse: 1 },
      { type: "supply_truck", total: 6, available: 4, inUse: 2 },
      { type: "ambulance", total: 4, available: 3, inUse: 1 },
    ],
    staff: [
      { role: "search_rescue", total: 30, available: 20, deployed: 10 },
      { role: "paramedic", total: 10, available: 7, deployed: 3 },
      { role: "driver", total: 8, available: 5, deployed: 3 },
      { role: "logistics", total: 5, available: 3, deployed: 2 },
    ],
    supplies: {
      water: { current: 8000, minimum: 3000, maximum: 15000 },
      medical: { current: 200, minimum: 80, maximum: 400 },
      blankets: { current: 500, minimum: 200, maximum: 1000 },
      food: { current: 1200, minimum: 500, maximum: 2500 },
    },
    contact: { phone: "+91-20-24321500", radio: "NDRF-CH2" },
  },
  {
    stationId: "RS-WARE-001",
    name: "Pune Relief Warehouse",
    type: "warehouse",
    location: {
      lat: 18.5505,
      lng: 73.9097,
      address: "Kharadi, Pune",
    },
    status: "active",
    fleet: [
      { type: "supply_truck", total: 12, available: 8, inUse: 4 },
      { type: "mobile_command", total: 2, available: 2, inUse: 0 },
    ],
    staff: [
      { role: "logistics", total: 20, available: 15, deployed: 5 },
      { role: "volunteer", total: 30, available: 22, deployed: 8 },
      { role: "driver", total: 14, available: 10, deployed: 4 },
    ],
    supplies: {
      water: { current: 20000, minimum: 8000, maximum: 30000 },
      medical: { current: 40, minimum: 50, maximum: 300 }, // intentionally low
      blankets: { current: 1500, minimum: 500, maximum: 3000 },
      food: { current: 3000, minimum: 1000, maximum: 5000 },
    },
    contact: { phone: "+91-20-27001234", radio: "LOG-CH4" },
  },
];

async function seed() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error("Missing MONGO_URI. Cannot connect to database.");
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  console.log("Connected to MongoDB");

  const shouldReset = process.argv.includes("--reset");

  if (shouldReset) {
    const deleted = await ResourceStation.deleteMany({});
    console.log(`Cleared ${deleted.deletedCount} existing resource stations`);
  }

  let created = 0;
  let skipped = 0;

  for (const station of STATIONS) {
    const exists = await ResourceStation.findOne({
      stationId: station.stationId,
    });
    if (exists) {
      console.log(`  Skipping ${station.stationId} (already exists)`);
      skipped++;
      continue;
    }
    await ResourceStation.create(station);
    console.log(`  ✓ Created ${station.name} (${station.stationId})`);
    created++;
  }

  console.log(
    `\nDone: ${created} created, ${skipped} skipped (total in DB: ${await ResourceStation.countDocuments()})`,
  );
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});

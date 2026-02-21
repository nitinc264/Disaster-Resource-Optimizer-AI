/**
 * Register Demo Stations Script
 * Registers all demo emergency stations with the main platform
 */

import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const MAIN_PLATFORM_URL =
  process.env.MAIN_PLATFORM_URL || "http://localhost:3000";

// Demo station configurations
const DEMO_STATIONS = [
  {
    stationId: "FIRE-STATION-001",
    name: "Fire Station - Central",
    type: "fire",
    location: {
      lat: 18.4549,
      lng: 73.8563,
      address: "Swargate, Pune",
    },
    apiConfig: {
      baseUrl: "http://localhost:4001",
      alertEndpoint: "/api/alerts/receive",
      apiKey: "fire-station-demo-key-2024",
    },
    capabilities: ["fire", "hazmat", "rescue", "general"],
    contact: {
      phone: "+91-20-12345001",
      email: "fire.central@demo.local",
      emergencyLine: "101",
    },
    isOperational24x7: true,
  },
  {
    stationId: "HOSPITAL-001",
    name: "City General Hospital",
    type: "hospital",
    location: {
      lat: 18.5135,
      lng: 73.7604,
      address: "Wakad, Pune",
    },
    apiConfig: {
      baseUrl: "http://localhost:4002",
      alertEndpoint: "/api/alerts/receive",
      apiKey: "hospital-station-demo-key-2024",
    },
    capabilities: ["medical", "rescue", "traffic_accident", "general"],
    contact: {
      phone: "+91-20-12345002",
      email: "hospital.city@demo.local",
      emergencyLine: "102",
    },
    isOperational24x7: true,
  },
  {
    stationId: "POLICE-STATION-001",
    name: "Police Station - Pimpri",
    type: "police",
    location: {
      lat: 18.6073,
      lng: 73.7654,
      address: "Pimpri, Pune",
    },
    apiConfig: {
      baseUrl: "http://localhost:4003",
      alertEndpoint: "/api/alerts/receive",
      apiKey: "police-station-demo-key-2024",
    },
    capabilities: ["traffic_accident", "general", "rescue"],
    contact: {
      phone: "+91-20-12345003",
      email: "police.pimpri@demo.local",
      emergencyLine: "100",
    },
    isOperational24x7: true,
  },
  {
    stationId: "RESCUE-STATION-001",
    name: "Rescue Team - Shivajinagar",
    type: "rescue",
    location: {
      lat: 18.5196,
      lng: 73.8553,
      address: "Shivajinagar, Pune",
    },
    apiConfig: {
      baseUrl: "http://localhost:4004",
      alertEndpoint: "/api/alerts/receive",
      apiKey: "rescue-station-demo-key-2024",
    },
    capabilities: [
      "rescue",
      "flood",
      "earthquake",
      "building_collapse",
      "landslide",
      "general",
    ],
    contact: {
      phone: "+91-20-12345004",
      email: "rescue.shivaji@demo.local",
      emergencyLine: "108",
    },
    isOperational24x7: true,
  },
];

async function registerStations() {
  console.log(
    "╔══════════════════════════════════════════════════════════════╗",
  );
  console.log(
    "║     REGISTERING DEMO EMERGENCY STATIONS                      ║",
  );
  console.log(
    "╚══════════════════════════════════════════════════════════════╝\n",
  );

  // First, authenticate (you may need to adjust this based on your auth setup)
  let authCookie = "";

  try {
    console.log("Attempting to authenticate with main platform...");
    const loginResponse = await axios.post(
      `${MAIN_PLATFORM_URL}/api/auth/login`,
      {
        pin: "0000", // Default manager PIN
      },
      {
        withCredentials: true,
      },
    );

    // Get session cookie
    const cookies = loginResponse.headers["set-cookie"];
    if (cookies) {
      authCookie = cookies[0].split(";")[0];
    }

    console.log("✅ Authenticated successfully\n");
  } catch (error) {
    console.log(
      "⚠️  Could not authenticate. Proceeding without auth (may fail if auth required).\n",
    );
  }

  const results = {
    success: [],
    failed: [],
    skipped: [],
  };

  for (const station of DEMO_STATIONS) {
    console.log(`\n📍 Registering: ${station.name}`);
    console.log(`   Type: ${station.type}`);
    console.log(`   API URL: ${station.apiConfig.baseUrl}`);

    try {
      const response = await axios.post(
        `${MAIN_PLATFORM_URL}/api/emergency-stations`,
        station,
        {
          headers: {
            "Content-Type": "application/json",
            Cookie: authCookie,
          },
        },
      );

      if (response.data.success !== false) {
        console.log(`   ✅ Registered successfully!`);
        results.success.push(station.name);
      } else {
        throw new Error(response.data.message || "Registration failed");
      }
    } catch (error) {
      if (error.response?.status === 409) {
        console.log(`   ⏭️  Station already registered (skipped)`);
        results.skipped.push(station.name);
      } else {
        const errorMsg =
          error.response?.data?.message || error.message || "Unknown error";
        const errorDetails = error.response?.data?.error || "";
        console.log(`   ❌ Failed: ${errorMsg}`);
        if (errorDetails) {
          console.log(`      Details: ${errorDetails}`);
        }
        if (error.code === "ECONNREFUSED") {
          console.log(
            `      ⚠️  Backend server not running at ${MAIN_PLATFORM_URL}`,
          );
        }
        results.failed.push(station.name);
      }
    }
  }

  // Summary
  console.log("\n" + "═".repeat(60));
  console.log("REGISTRATION SUMMARY");
  console.log("═".repeat(60));
  console.log(`✅ Successfully registered: ${results.success.length}`);
  results.success.forEach((name) => console.log(`   - ${name}`));

  console.log(`⏭️  Already registered: ${results.skipped.length}`);
  results.skipped.forEach((name) => console.log(`   - ${name}`));

  console.log(`❌ Failed: ${results.failed.length}`);
  results.failed.forEach((name) => console.log(`   - ${name}`));

  console.log("\n" + "═".repeat(60));

  if (results.success.length + results.skipped.length > 0) {
    console.log("\n🎉 Demo stations are ready!");
    console.log("\nTo start the station servers, run:");
    console.log("  npm run start:all    (starts all stations)");
    console.log("\nOr individually:");
    console.log("  npm run start:fire      (port 4001)");
    console.log("  npm run start:hospital  (port 4002)");
    console.log("  npm run start:police    (port 4003)");
    console.log("  npm run start:rescue    (port 4004)");
    console.log("\nStation dashboards will be available at:");
    console.log("  🚒 Fire Station:    http://localhost:4001");
    console.log("  🏥 Hospital:        http://localhost:4002");
    console.log("  🚔 Police Station:  http://localhost:4003");
    console.log("  🚑 Rescue Team:     http://localhost:4004");
  }
}

// Run registration
registerStations().catch(console.error);

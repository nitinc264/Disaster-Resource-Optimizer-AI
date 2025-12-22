/**
 * Test Alert Script
 * Sends a test alert directly to a demo station
 *
 * Usage: node scripts/test-alert.js [station-type]
 * Example: node scripts/test-alert.js fire
 */

import axios from "axios";

const STATION_PORTS = {
  fire: 4001,
  hospital: 4002,
  police: 4003,
  rescue: 4004,
};

const STATION_API_KEYS = {
  fire: "fire-station-demo-key-2024",
  hospital: "hospital-demo-key-2024",
  police: "police-station-demo-key-2024",
  rescue: "rescue-station-demo-key-2024",
};

const TEST_ALERTS = {
  fire: {
    alertId: `TEST-FIRE-${Date.now()}`,
    emergencyType: "fire",
    severity: 8,
    location: { lat: 18.52, lng: 73.85 },
    title: "🔥 TEST: Building Fire Reported",
    description:
      "Multi-story building fire with people possibly trapped. Smoke visible from distance.",
    needs: ["Fire Suppression", "Rescue", "Medical"],
    timestamp: new Date().toISOString(),
    fromStation: { name: "Disaster Response HQ", type: "command" },
  },
  hospital: {
    alertId: `TEST-MED-${Date.now()}`,
    emergencyType: "medical",
    severity: 7,
    location: { lat: 18.51, lng: 73.8 },
    title: "🏥 TEST: Mass Casualty Incident",
    description:
      "Traffic accident with multiple injuries. Approximately 5 people need medical attention.",
    needs: ["Medical", "Ambulance"],
    timestamp: new Date().toISOString(),
    fromStation: { name: "Disaster Response HQ", type: "command" },
  },
  police: {
    alertId: `TEST-POL-${Date.now()}`,
    emergencyType: "traffic_accident",
    severity: 6,
    location: { lat: 18.6, lng: 73.76 },
    title: "🚔 TEST: Major Traffic Accident",
    description:
      "Multi-vehicle collision blocking highway. Traffic control needed.",
    needs: ["Traffic Control", "Medical"],
    timestamp: new Date().toISOString(),
    fromStation: { name: "Disaster Response HQ", type: "command" },
  },
  rescue: {
    alertId: `TEST-RES-${Date.now()}`,
    emergencyType: "rescue",
    severity: 9,
    location: { lat: 18.53, lng: 73.86 },
    title: "🚑 TEST: Building Collapse - Rescue Needed",
    description:
      "Partial building collapse. Multiple people reported trapped under rubble.",
    needs: ["Rescue", "Medical", "Heavy Equipment"],
    timestamp: new Date().toISOString(),
    fromStation: { name: "Disaster Response HQ", type: "command" },
  },
};

async function sendTestAlert(stationType) {
  const port = STATION_PORTS[stationType];
  const apiKey = STATION_API_KEYS[stationType];
  const alert = TEST_ALERTS[stationType];

  console.log("\n" + "=".repeat(60));
  console.log(`📤 SENDING TEST ALERT TO ${stationType.toUpperCase()} STATION`);
  console.log("=".repeat(60));
  console.log(`URL: http://localhost:${port}/api/alerts/receive`);
  console.log(`Alert ID: ${alert.alertId}`);
  console.log(`Type: ${alert.emergencyType}`);
  console.log(`Severity: ${alert.severity}/10`);
  console.log(`Title: ${alert.title}`);
  console.log("=".repeat(60) + "\n");

  try {
    const response = await axios.post(
      `http://localhost:${port}/api/alerts/receive`,
      alert,
      {
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": apiKey,
          "X-Alert-Priority": alert.severity >= 7 ? "critical" : "normal",
        },
        timeout: 5000,
      }
    );

    console.log("✅ Alert sent successfully!");
    console.log("Response:", JSON.stringify(response.data, null, 2));
  } catch (error) {
    if (error.code === "ECONNREFUSED") {
      console.log(
        `❌ Connection refused. Is the ${stationType} station running?`
      );
      console.log(`   Start it with: npm run start:${stationType}`);
    } else {
      console.log("❌ Failed to send alert:");
      console.log(error.response?.data || error.message);
    }
  }
}

async function main() {
  const stationType = process.argv[2] || "fire";

  if (!STATION_PORTS[stationType]) {
    console.log(`Unknown station type: ${stationType}`);
    console.log(`Available types: ${Object.keys(STATION_PORTS).join(", ")}`);
    process.exit(1);
  }

  await sendTestAlert(stationType);

  console.log("\n💡 Tip: Open the station dashboard to see the alert:");
  console.log(`   http://localhost:${STATION_PORTS[stationType]}`);
}

main();

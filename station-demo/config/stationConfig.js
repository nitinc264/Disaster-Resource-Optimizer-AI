/**
 * Station Configuration
 * Configures each type of emergency station with appropriate settings
 */

const STATION_CONFIGS = {
  fire: {
    stationId: "FIRE-STATION-001",
    name: "Fire Station - Central",
    type: "fire",
    emoji: "🚒",
    capabilities: ["fire", "hazmat", "rescue", "general"],
    location: {
      lat: 18.4549,
      lng: 73.8563,
      address: "Swargate, Pune",
    },
    alertSound: "fire-alarm.mp3",
    themeColor: "#f97316", // Orange
    port: 4001,
  },
  hospital: {
    stationId: "HOSPITAL-001",
    name: "City General Hospital",
    type: "hospital",
    emoji: "🏥",
    capabilities: ["medical", "rescue", "general"],
    location: {
      lat: 18.5135,
      lng: 73.7604,
      address: "Wakad, Pune",
    },
    alertSound: "hospital-alert.mp3",
    themeColor: "#ef4444", // Red
    port: 4002,
  },
  police: {
    stationId: "POLICE-STATION-001",
    name: "Police Station - Pimpri",
    type: "police",
    emoji: "🚔",
    capabilities: ["traffic_accident", "rescue", "general"],
    location: {
      lat: 18.6073,
      lng: 73.7654,
      address: "Pimpri, Pune",
    },
    alertSound: "police-siren.mp3",
    themeColor: "#3b82f6", // Blue
    port: 4003,
  },
  rescue: {
    stationId: "RESCUE-STATION-001",
    name: "Rescue Team - Shivajinagar",
    type: "rescue",
    emoji: "🚑",
    capabilities: [
      "rescue",
      "flood",
      "earthquake",
      "building_collapse",
      "general",
    ],
    location: {
      lat: 18.5196,
      lng: 73.8553,
      address: "Shivajinagar, Pune",
    },
    alertSound: "rescue-alert.mp3",
    themeColor: "#10b981", // Green
    port: 4004,
  },
};

/**
 * Get station configuration based on environment variable
 */
export function getStationConfig() {
  const stationType = process.env.STATION_TYPE || "fire";
  const port =
    process.env.STATION_PORT || STATION_CONFIGS[stationType]?.port || 4001;

  const config = STATION_CONFIGS[stationType];

  if (!config) {
    console.error(`Unknown station type: ${stationType}`);
    process.exit(1);
  }

  // Generate a consistent API key based on station type
  const defaultApiKeys = {
    fire: "fire-station-demo-key-2024",
    hospital: "hospital-demo-key-2024",
    police: "police-station-demo-key-2024",
    rescue: "rescue-station-demo-key-2024",
  };

  return {
    ...config,
    port: parseInt(port),
    apiKey:
      process.env.STATION_API_KEY ||
      defaultApiKeys[stationType] ||
      `${stationType}-api-key-demo`,
  };
}

export { STATION_CONFIGS };

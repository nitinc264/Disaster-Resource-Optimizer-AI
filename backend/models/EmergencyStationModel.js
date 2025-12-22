import mongoose from "mongoose";

/**
 * Emergency Station Model
 * Stores registered emergency service stations that can receive alerts
 */
const emergencyStationSchema = new mongoose.Schema(
  {
    // Station identification
    stationId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },

    // Station type
    type: {
      type: String,
      enum: [
        "fire",
        "hospital",
        "police",
        "rescue",
        "ambulance",
        "coast_guard",
      ],
      required: true,
    },

    // Location
    location: {
      lat: {
        type: Number,
        required: true,
      },
      lng: {
        type: Number,
        required: true,
      },
      address: {
        type: String,
        trim: true,
      },
    },

    // API Configuration for sending alerts
    apiConfig: {
      baseUrl: {
        type: String,
        required: true,
        trim: true,
      },
      alertEndpoint: {
        type: String,
        default: "/api/alerts/receive",
        trim: true,
      },
      apiKey: {
        type: String,
        required: true,
        trim: true,
      },
    },

    // Station capabilities - what types of emergencies they handle
    capabilities: {
      type: [String],
      enum: [
        "fire",
        "flood",
        "earthquake",
        "medical",
        "hospital",
        "rescue",
        "police",
        "traffic_accident",
        "hazmat",
        "building_collapse",
        "landslide",
        "storm",
        "ambulance",
        "coast_guard",
        "general",
      ],
      default: ["general"],
    },

    // Station status
    status: {
      type: String,
      enum: ["active", "inactive", "busy", "offline"],
      default: "active",
    },

    // Contact information
    contact: {
      phone: String,
      email: String,
      emergencyLine: String,
    },

    // Operational hours (24/7 by default for emergency services)
    isOperational24x7: {
      type: Boolean,
      default: true,
    },

    // Last successful communication
    lastPingAt: {
      type: Date,
      default: null,
    },

    // Statistics
    stats: {
      totalAlertsReceived: {
        type: Number,
        default: 0,
      },
      totalAlertsAcknowledged: {
        type: Number,
        default: 0,
      },
      averageResponseTime: {
        type: Number, // in seconds
        default: null,
      },
    },
  },
  {
    timestamps: true,
  }
);

// Index for geospatial queries
emergencyStationSchema.index({ "location.lat": 1, "location.lng": 1 });
emergencyStationSchema.index({ type: 1, status: 1 });

/**
 * Calculate distance between two points using Haversine formula
 */
emergencyStationSchema.statics.calculateDistance = function (
  lat1,
  lng1,
  lat2,
  lng2
) {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Find nearest stations of a given type
 */
emergencyStationSchema.statics.findNearest = async function (
  lat,
  lng,
  type,
  limit = 3
) {
  const stations = await this.find({
    type,
    status: "active",
  });

  // Calculate distances and sort
  const stationsWithDistance = stations.map((station) => ({
    station,
    distance: this.calculateDistance(
      lat,
      lng,
      station.location.lat,
      station.location.lng
    ),
  }));

  stationsWithDistance.sort((a, b) => a.distance - b.distance);

  return stationsWithDistance.slice(0, limit);
};

/**
 * Find stations that can handle a specific emergency type
 */
emergencyStationSchema.statics.findByCapability = async function (
  emergencyType,
  lat,
  lng,
  limit = 5
) {
  const stations = await this.find({
    capabilities: emergencyType,
    status: "active",
  });

  // Calculate distances and sort
  const stationsWithDistance = stations.map((station) => ({
    station,
    distance: this.calculateDistance(
      lat,
      lng,
      station.location.lat,
      station.location.lng
    ),
  }));

  stationsWithDistance.sort((a, b) => a.distance - b.distance);

  return stationsWithDistance.slice(0, limit);
};

export default mongoose.model("EmergencyStation", emergencyStationSchema);

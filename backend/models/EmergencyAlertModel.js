import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";

/**
 * Emergency Alert Model
 * Tracks alerts sent to emergency stations
 */
const emergencyAlertSchema = new mongoose.Schema(
  {
    // Alert identification
    alertId: {
      type: String,
      default: () => uuidv4(),
      unique: true,
      required: true,
    },

    // Reference to the original report/need
    sourceType: {
      type: String,
      enum: ["Report", "Need"],
      required: true,
    },
    sourceId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: "sourceType",
    },
    // Direct reference to source document for callbacks
    sourceDocument: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Report",
    },

    // Emergency classification
    emergencyType: {
      type: String,
      enum: [
        "fire",
        "flood",
        "earthquake",
        "medical",
        "rescue",
        "traffic_accident",
        "hazmat",
        "building_collapse",
        "landslide",
        "storm",
        "police",
        "general",
      ],
      required: true,
    },

    // Severity (1-10)
    severity: {
      type: Number,
      min: 1,
      max: 10,
      required: true,
    },

    // Location of the emergency
    location: {
      lat: {
        type: Number,
        required: true,
      },
      lng: {
        type: Number,
        required: true,
      },
      address: String,
    },

    // Alert details
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    needs: {
      type: [String],
      default: [],
    },

    // Stations this alert was sent to
    sentToStations: [
      {
        stationId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "EmergencyStation",
        },
        stationName: String,
        stationType: String,
        distance: Number, // km
        sentAt: {
          type: Date,
          default: Date.now,
        },
        deliveryStatus: {
          type: String,
          enum: [
            "pending",
            "sent",
            "delivered",
            "failed",
            "acknowledged",
            "rejected",
            "responding",
            "resolved",
          ],
          default: "pending",
        },
        status: {
          type: String,
          enum: [
            "pending",
            "acknowledged",
            "rejected",
            "responding",
            "resolved",
          ],
          default: "pending",
        },
        acknowledgedAt: Date,
        respondedAt: Date,
        rejectedAt: Date,
        resolvedAt: Date,
        rejectionReason: String,
        responseNotes: String,
        notes: String,
      },
    ],

    // Alert status
    status: {
      type: String,
      enum: [
        "created",
        "dispatched",
        "acknowledged",
        "responding",
        "resolved",
        "cancelled",
      ],
      default: "created",
    },

    // Timestamps
    dispatchedAt: Date,
    acknowledgedAt: Date,
    resolvedAt: Date,

    // Additional metadata
    metadata: {
      originalText: String,
      imageUrl: String,
      audioUrl: String,
      aiAnalysis: {
        type: mongoose.Schema.Types.Mixed,
      },
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
emergencyAlertSchema.index({ status: 1, createdAt: -1 });
emergencyAlertSchema.index({ emergencyType: 1 });
emergencyAlertSchema.index({ "sentToStations.stationId": 1 });

export default mongoose.model("EmergencyAlert", emergencyAlertSchema);

import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";

const reportSchema = new mongoose.Schema(
  {
    // Unique identifier
    reportId: {
      type: String,
      default: () => uuidv4(),
      unique: true,
      required: true,
    },

    // Inputs
    source: {
      type: String,
      enum: ["PWA", "SMS", "WhatsApp", "Audio"],
      required: true,
    },
    text: {
      type: String,
      default: null,
    },
    imageUrl: {
      type: String,
      default: null,
    },
    audioUrl: {
      type: String,
      default: null,
    },
    location: {
      lat: {
        type: Number,
        required: true,
      },
      lng: {
        type: Number,
        required: true,
      },
    },

    // State Machine
    status: {
      type: String,
      enum: [
        "Pending",
        "Processing_Audio",
        "Pending_Transcription",
        "Processing_Visual",
        "Analyzed_Visual",
        "Processing_Oracle",
        "Analyzed_Full",
        "Analyzed",
        "Clustered",
        "Resolved",
        "Error",
      ],
      default: "Pending",
    },

    // Agent Outputs
    sentinelData: {
      tag: {
        type: String,
        default: null,
      },
      confidence: {
        type: Number,
        min: 0,
        max: 1,
        default: null,
      },
    },
    oracleData: {
      severity: {
        type: Number,
        min: 1,
        max: 10,
        default: null,
      },
      needs: {
        type: [String],
        default: [],
      },
    },
    audioData: {
      transcription: {
        type: String,
        default: null,
      },
    },

    // Emergency Station Status - tracks alert routing
    emergencyStatus: {
      type: String,
      enum: [
        "none", // Not yet assigned (gray)
        "pending", // Verified but not assigned (green)
        "assigned", // Assigned to station (yellow)
        "dispatched", // Station dispatched units (orange)
        "rejected", // Rejected by station, needs reroute (red)
        "resolved", // Emergency resolved
      ],
      default: "none",
    },

    // Emergency alert reference
    emergencyAlertId: {
      type: String,
      default: null,
    },

    // Assigned station info
    assignedStation: {
      stationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "EmergencyStation",
        default: null,
      },
      stationName: String,
      stationType: String,
      assignedAt: Date,
      dispatchedAt: Date,
      rejectedAt: Date,
      rejectionReason: String,
    },

    // Metadata
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt fields
  }
);

// Indexes for common queries
// Note: reportId already has unique: true, so no need to add another index
reportSchema.index({ status: 1 });
reportSchema.index({ timestamp: -1 });
reportSchema.index({ "location.lat": 1, "location.lng": 1 });

const Report = mongoose.model("Report", reportSchema);

export default Report;

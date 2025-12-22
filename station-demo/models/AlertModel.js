import mongoose from "mongoose";

/**
 * Alert Model for Station Database
 * Stores alerts received from the main disaster response platform
 */
const alertSchema = new mongoose.Schema(
  {
    // Alert identification (from main platform)
    alertId: {
      type: String,
      required: true,
      unique: true,
    },

    // Emergency details
    emergencyType: {
      type: String,
      required: true,
    },
    severity: {
      type: Number,
      min: 1,
      max: 10,
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
      address: String,
    },

    // Alert content
    title: {
      type: String,
      required: true,
    },
    description: String,
    needs: [String],

    // Source information
    fromStation: {
      name: String,
      type: { type: String },
    },

    // Status tracking
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

    // Response tracking
    acknowledgedAt: Date,
    dispatchedAt: Date,
    arrivedAt: Date,
    resolvedAt: Date,
    rejectedAt: Date,
    rejectionReason: String,

    // Assigned resources
    assignedUnits: [
      {
        unitId: String,
        unitName: String,
        assignedAt: Date,
      },
    ],

    // Notes and updates
    notes: [
      {
        text: String,
        createdAt: {
          type: Date,
          default: Date.now,
        },
        createdBy: String,
      },
    ],

    // Original timestamp from main platform
    originalTimestamp: Date,
  },
  {
    timestamps: true,
  }
);

// Indexes
alertSchema.index({ alertId: 1 });
alertSchema.index({ status: 1, createdAt: -1 });
alertSchema.index({ severity: -1 });

export default mongoose.model("Alert", alertSchema);

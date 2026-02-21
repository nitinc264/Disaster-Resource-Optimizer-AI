import mongoose from "mongoose";

/**
 * This nested schema stores the structured data extracted by the Gemini AI.
 */
const TriageDataSchema = new mongoose.Schema({
  needType: {
    type: String,
    enum: ["Water", "Food", "Medical", "Rescue", "Other"],
    default: "Other",
  },
  location: {
    type: String,
    trim: true,
  },
  details: {
    type: String,
    trim: true,
  },
  urgency: {
    type: String,
    enum: ["Low", "Medium", "High"],
    default: "Medium",
  },
});

const CoordinateSchema = new mongoose.Schema(
  {
    lat: Number,
    lng: Number,
    formattedAddress: String,
  },
  { _id: false },
);

/**
 * This is the main schema for a citizen's report.
 * It links to the volunteer who verifies it and the manager who assigns it.
 */
const NeedSchema = new mongoose.Schema(
  {
    fromNumber: {
      type: String,
      required: true,
      trim: true,
    },
    rawMessage: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      required: true,
      enum: ["Unverified", "Verified", "InProgress", "Completed", "Flagged"],
      default: "Unverified",
    },
    /**
     * Emergency status tracking for station dispatch
     */
    emergencyStatus: {
      type: String,
      enum: [
        "none",
        "pending",
        "assigned",
        "dispatched",
        "rejected",
        "resolved",
      ],
      default: "none",
    },
    emergencyType: {
      type: String,
      default: "general",
    },
    emergencyAlertId: {
      type: String,
    },
    assignedStation: {
      stationId: mongoose.Schema.Types.ObjectId,
      stationName: String,
      stationType: String,
      assignedAt: Date,
      dispatchedAt: Date,
      rejectedAt: Date,
      resolvedAt: Date,
      rejectionReason: String,
    },
    /**
     * Dispatch tracking (set by logistics agent via pymongo and reroute endpoint)
     */
    dispatch_status: {
      type: String,
      enum: ["Pending", "Unassigned", "Assigned"],
      default: "Unassigned",
    },
    mission_id: {
      type: mongoose.Schema.Types.ObjectId,
    },
    assigned_station: {
      type: mongoose.Schema.Types.Mixed,
    },
    assigned_at: {
      type: Date,
    },
    /**
     * When rerouted to a specific station, stores the target station info
     */
    rerouted_to_station: {
      type: mongoose.Schema.Types.Mixed,
    },
    /**
     * Stores the structured data from the Gemini AI triage.
     */
    triageData: TriageDataSchema,
    coordinates: CoordinateSchema,
    verificationNotes: {
      type: String,
      trim: true,
    },
    verifiedAt: Date,
  },
  {
    timestamps: true, // Adds createdAt and updatedAt timestamps
  },
);

// Indexes for common queries
NeedSchema.index({ status: 1, createdAt: -1 });
NeedSchema.index({ fromNumber: 1, status: 1 });
NeedSchema.index({ "coordinates.lat": 1, "coordinates.lng": 1 });
NeedSchema.index({ emergencyStatus: 1 });

export default mongoose.model("Need", NeedSchema);

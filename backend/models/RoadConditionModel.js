import mongoose from "mongoose";

/**
 * Road Condition Schema
 * Tracks blocked, flooded, or damaged roads affecting rescue routes
 */
const roadConditionSchema = new mongoose.Schema({
  // Unique identifier
  conditionId: {
    type: String,
    required: true,
    unique: true,
  },

  // Location details
  startPoint: {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
  },
  endPoint: {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
  },
  roadName: {
    type: String,
    default: "Unknown Road",
  },
  description: {
    type: String,
    required: true,
  },

  // Condition type
  conditionType: {
    type: String,
    enum: [
      "blocked",
      "flooded",
      "damaged",
      "debris",
      "accident",
      "construction",
      "other",
    ],
    required: true,
  },

  // Severity level
  severity: {
    type: String,
    enum: ["low", "medium", "high", "critical"],
    default: "medium",
  },

  // Status
  status: {
    type: String,
    enum: ["active", "cleared", "partial"],
    default: "active",
  },

  // Reporter info
  reportedBy: {
    type: String, // volunteer ID or "anonymous"
    default: "anonymous",
  },
  reporterType: {
    type: String,
    enum: ["volunteer", "official", "public", "system"],
    default: "public",
  },

  // Verification
  verified: {
    type: Boolean,
    default: false,
  },
  verifiedBy: String,
  verifiedAt: Date,
  verificationCount: {
    type: Number,
    default: 0,
  },

  // Photo evidence
  photos: [
    {
      url: String,
      uploadedAt: Date,
    },
  ],

  // Estimated clearance time
  estimatedClearTime: Date,

  // Timestamps
  reportedAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  clearedAt: Date,
});

// Index for geospatial queries
roadConditionSchema.index({ "startPoint.lat": 1, "startPoint.lng": 1 });
roadConditionSchema.index({ status: 1, conditionType: 1 });

const RoadCondition = mongoose.model("RoadCondition", roadConditionSchema);

export default RoadCondition;

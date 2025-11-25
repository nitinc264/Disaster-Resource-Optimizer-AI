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
    lon: Number,
    formattedAddress: String,
  },
  { _id: false }
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
  }
);

export default mongoose.model("Need", NeedSchema);

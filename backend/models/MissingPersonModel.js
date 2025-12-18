import mongoose from "mongoose";

/**
 * Missing Person Schema
 * Family reunification module - missing persons registry
 */
const missingPersonSchema = new mongoose.Schema({
  // Unique case ID
  caseId: {
    type: String,
    required: true,
    unique: true,
  },

  // Personal information
  fullName: {
    type: String,
    required: true,
  },
  nickname: String,
  age: Number,
  gender: {
    type: String,
    enum: ["male", "female", "other", "unknown"],
    default: "unknown",
  },

  // Physical description
  description: {
    height: String, // e.g., "5'8" or "175cm"
    weight: String,
    hairColor: String,
    eyeColor: String,
    distinguishingFeatures: String, // scars, tattoos, etc.
    clothing: String, // Last known clothing
    medicalConditions: String,
  },

  // Photo
  photos: [
    {
      url: String,
      isPrimary: { type: Boolean, default: false },
      uploadedAt: { type: Date, default: Date.now },
    },
  ],

  // Last known location
  lastSeenLocation: {
    lat: Number,
    lng: Number,
    address: String,
    landmark: String,
  },
  lastSeenDate: {
    type: Date,
    required: true,
  },

  // Contact information for reporter
  reporterInfo: {
    name: { type: String, required: true },
    relationship: String,
    phone: { type: String, required: true },
    email: String,
    alternatePhone: String,
  },

  // Case status
  status: {
    type: String,
    enum: ["missing", "found", "reunited", "deceased", "investigating"],
    default: "missing",
  },

  // Priority level
  priority: {
    type: String,
    enum: ["low", "medium", "high", "critical"],
    default: "medium",
  },

  // Vulnerability flags
  isChild: { type: Boolean, default: false },
  isElderly: { type: Boolean, default: false },
  hasMedicalNeeds: { type: Boolean, default: false },
  hasDisability: { type: Boolean, default: false },

  // Found information (when status changes to found)
  foundInfo: {
    foundDate: Date,
    foundLocation: {
      lat: Number,
      lng: Number,
      address: String,
    },
    foundBy: String,
    currentShelter: String,
    condition: {
      type: String,
      enum: ["healthy", "injured", "critical", "deceased"],
    },
    notes: String,
  },

  // Potential matches
  potentialMatches: [
    {
      matchedPersonId: String,
      matchConfidence: Number, // 0-100
      matchedAt: Date,
      matchType: {
        type: String,
        enum: ["photo", "description", "location", "manual"],
      },
      reviewed: { type: Boolean, default: false },
      isMatch: Boolean,
    },
  ],

  // Timestamps
  reportedAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  resolvedAt: Date,
});

// Indexes
missingPersonSchema.index({ status: 1, priority: 1 });
missingPersonSchema.index({
  fullName: "text",
  "description.distinguishingFeatures": "text",
});
missingPersonSchema.index({
  "lastSeenLocation.lat": 1,
  "lastSeenLocation.lng": 1,
});

const MissingPerson = mongoose.model("MissingPerson", missingPersonSchema);

export default MissingPerson;

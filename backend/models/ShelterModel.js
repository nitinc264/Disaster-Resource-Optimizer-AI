import mongoose from "mongoose";

/**
 * Shelter Schema
 * Evacuation center management - capacity and needs tracking
 */
const shelterSchema = new mongoose.Schema(
  {
    // Unique identifier
    shelterId: {
      type: String,
      required: true,
      unique: true,
    },

    // Basic information
    name: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: [
        "school",
        "community_center",
        "stadium",
        "government_building",
        "religious",
        "temporary",
        "other",
      ],
      default: "other",
    },

    // Location
    location: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
      address: String,
      landmark: String,
      area: String,
    },

    // Contact
    contact: {
      managerName: String,
      phone: String,
      alternatePhone: String,
      email: String,
    },

    // Capacity
    capacity: {
      total: { type: Number, required: true },
      current: { type: Number, default: 0 },
      families: { type: Number, default: 0 },
      individuals: { type: Number, default: 0 },
      children: { type: Number, default: 0 },
      elderly: { type: Number, default: 0 },
      specialNeeds: { type: Number, default: 0 },
    },

    // Facilities available
    facilities: {
      hasMedicalFacility: { type: Boolean, default: false },
      hasKitchen: { type: Boolean, default: false },
      hasToilets: { type: Number, default: 0 },
      hasShowers: { type: Number, default: 0 },
      hasElectricity: { type: Boolean, default: true },
      hasWater: { type: Boolean, default: true },
      hasInternet: { type: Boolean, default: false },
      isAccessible: { type: Boolean, default: false }, // Wheelchair accessible
      hasPetArea: { type: Boolean, default: false },
    },

    // Current supplies inventory
    supplies: {
      water: {
        available: Number,
        needed: Number,
        unit: { type: String, default: "liters" },
      },
      food: {
        available: Number,
        needed: Number,
        unit: { type: String, default: "meals" },
      },
      blankets: {
        available: Number,
        needed: Number,
        unit: { type: String, default: "pieces" },
      },
      medicalKits: {
        available: Number,
        needed: Number,
        unit: { type: String, default: "kits" },
      },
      hygiene: {
        available: Number,
        needed: Number,
        unit: { type: String, default: "kits" },
      },
      diapers: {
        available: Number,
        needed: Number,
        unit: { type: String, default: "packs" },
      },
      medicines: {
        available: Number,
        needed: Number,
        unit: { type: String, default: "units" },
      },
    },

    // Urgent needs
    urgentNeeds: [
      {
        item: String,
        quantity: Number,
        priority: { type: String, enum: ["low", "medium", "high", "critical"] },
        requestedAt: { type: Date, default: Date.now },
      },
    ],

    // Status
    status: {
      type: String,
      enum: ["open", "full", "closed", "preparing", "evacuating"],
      default: "open",
    },

    // Conditions
    conditions: {
      type: String,
      enum: ["good", "fair", "poor", "critical"],
      default: "good",
    },

    // Operating hours
    operatingHours: {
      is24Hours: { type: Boolean, default: true },
      openTime: String,
      closeTime: String,
    },

    // Last inspected
    lastInspection: {
      date: Date,
      inspector: String,
      notes: String,
      issues: [String],
    },

    // Check-in/out log (summary)
    dailyStats: [
      {
        date: Date,
        checkIns: Number,
        checkOuts: Number,
        mealsServed: Number,
        medicalCases: Number,
      },
    ],

    // Notes
    notes: String,
  },
  {
    timestamps: true,
  },
);

// Indexes
shelterSchema.index({ status: 1 });
shelterSchema.index({ "location.lat": 1, "location.lng": 1 });
shelterSchema.index({ "location.area": 1 });

// Virtual for occupancy percentage
shelterSchema.virtual("occupancyPercentage").get(function () {
  if (!this.capacity.total) return 0;
  return Math.round((this.capacity.current / this.capacity.total) * 100);
});

// Virtual for available spots
shelterSchema.virtual("availableSpots").get(function () {
  return Math.max(0, this.capacity.total - this.capacity.current);
});

const Shelter = mongoose.model("Shelter", shelterSchema);

export default Shelter;

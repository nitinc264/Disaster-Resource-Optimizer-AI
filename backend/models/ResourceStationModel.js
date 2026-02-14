import mongoose from "mongoose";

/**
 * Resource Station Model
 * Tracks vehicles, personnel, and supply inventories at emergency stations
 * Used for real-time resource allocation during disaster response
 */

const supplySchema = new mongoose.Schema(
  {
    current: { type: Number, default: 0, min: 0 },
    minimum: { type: Number, default: 0, min: 0 },
    maximum: { type: Number, default: 0, min: 0 },
  },
  { _id: false },
);

const resourceStationSchema = new mongoose.Schema(
  {
    // Unique station identifier
    stationId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    // Station name
    name: {
      type: String,
      required: true,
      trim: true,
    },

    // Station type (matches EmergencyStation types)
    type: {
      type: String,
      enum: ["fire", "hospital", "police", "rescue", "ambulance", "warehouse"],
      required: true,
    },

    // Location
    location: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
      address: { type: String, trim: true },
    },

    // Status
    status: {
      type: String,
      enum: ["active", "inactive", "maintenance"],
      default: "active",
    },

    // Fleet vehicles
    vehicles: {
      total: { type: Number, default: 0, min: 0 },
      available: { type: Number, default: 0, min: 0 },
      deployed: { type: Number, default: 0, min: 0 },
      maintenance: { type: Number, default: 0, min: 0 },
    },

    // Vehicle breakdown by type
    fleet: [
      {
        type: {
          type: String,
          enum: [
            "ambulance",
            "fire_truck",
            "supply_truck",
            "rescue_helicopter",
            "mobile_command",
            "patrol_car",
            "rescue_boat",
          ],
        },
        total: { type: Number, default: 0, min: 0 },
        available: { type: Number, default: 0, min: 0 },
        inUse: { type: Number, default: 0, min: 0 },
      },
    ],

    // Personnel
    personnel: {
      total: { type: Number, default: 0, min: 0 },
      available: { type: Number, default: 0, min: 0 },
      onDuty: { type: Number, default: 0, min: 0 },
      deployed: { type: Number, default: 0, min: 0 },
    },

    // Personnel breakdown by role
    staff: [
      {
        role: {
          type: String,
          enum: [
            "paramedic",
            "firefighter",
            "search_rescue",
            "medical_doctor",
            "logistics",
            "police_officer",
            "volunteer",
            "driver",
          ],
        },
        total: { type: Number, default: 0, min: 0 },
        available: { type: Number, default: 0, min: 0 },
        deployed: { type: Number, default: 0, min: 0 },
      },
    ],

    // Supply inventory (keyed by supply type)
    supplies: {
      water: { type: supplySchema, default: () => ({}) },
      medical: { type: supplySchema, default: () => ({}) },
      blankets: { type: supplySchema, default: () => ({}) },
      food: { type: supplySchema, default: () => ({}) },
    },

    // Last time supplies were restocked
    lastRestocked: {
      type: Date,
      default: Date.now,
    },

    // Contact information
    contact: {
      phone: String,
      email: String,
      managerName: String,
    },

    // Linked EmergencyStation (optional)
    emergencyStationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "EmergencyStation",
    },
  },
  {
    timestamps: true,
  },
);

// Indexes
resourceStationSchema.index({ type: 1, status: 1 });
resourceStationSchema.index({ "location.lat": 1, "location.lng": 1 });

// Virtual: compute vehicle availability percentage
resourceStationSchema.virtual("vehicleAvailabilityPercent").get(function () {
  if (!this.vehicles.total) return 0;
  return Math.round((this.vehicles.available / this.vehicles.total) * 100);
});

// Virtual: get low-stock supplies
resourceStationSchema.virtual("lowStockSupplies").get(function () {
  const lowStock = [];
  if (this.supplies) {
    for (const [key, supply] of Object.entries(this.supplies.toObject())) {
      if (supply.current < supply.minimum) {
        lowStock.push({
          type: key,
          current: supply.current,
          minimum: supply.minimum,
          deficit: supply.minimum - supply.current,
        });
      }
    }
  }
  return lowStock;
});

// Ensure JSON includes virtuals
resourceStationSchema.set("toJSON", { virtuals: true });
resourceStationSchema.set("toObject", { virtuals: true });

// Pre-save: recalculate vehicle totals from fleet breakdown
resourceStationSchema.pre("save", function (next) {
  if (this.fleet && this.fleet.length > 0) {
    this.vehicles.total = this.fleet.reduce((sum, f) => sum + f.total, 0);
    this.vehicles.available = this.fleet.reduce(
      (sum, f) => sum + f.available,
      0,
    );
    this.vehicles.deployed = this.fleet.reduce((sum, f) => sum + f.inUse, 0);
  }
  if (this.staff && this.staff.length > 0) {
    this.personnel.total = this.staff.reduce((sum, s) => sum + s.total, 0);
    this.personnel.available = this.staff.reduce(
      (sum, s) => sum + s.available,
      0,
    );
    this.personnel.deployed = this.staff.reduce(
      (sum, s) => sum + s.deployed,
      0,
    );
  }
  next();
});

export default mongoose.model("ResourceStation", resourceStationSchema);

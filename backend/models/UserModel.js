import mongoose from "mongoose";

/**
 * User schema for volunteers and managers.
 * Uses a simple 4-digit PIN for quick authentication during emergencies.
 */
const UserSchema = new mongoose.Schema(
  {
    pin: {
      type: String,
      required: true,
      unique: true,
      match: [/^\d{4}$/, "PIN must be exactly 4 digits"],
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    role: {
      type: String,
      enum: ["volunteer", "manager"],
      default: "volunteer",
    },
    phone: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    skills: {
      type: [String],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLogin: {
      type: Date,
    },
    registeredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

const User = mongoose.model("User", UserSchema);

export default User;

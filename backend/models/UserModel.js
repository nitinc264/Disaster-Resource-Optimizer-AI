import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const BCRYPT_ROUNDS = 10;

/**
 * User schema for volunteers and managers.
 * Uses a simple 4-digit PIN for quick authentication during emergencies.
 * PINs are bcrypt-hashed before storage.
 */
const UserSchema = new mongoose.Schema(
  {
    pin: {
      type: String,
      required: true,
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
  },
);

/**
 * Hash the PIN before saving if it has been modified.
 * Raw PINs are 4 digits; hashed PINs are 60-char bcrypt strings.
 */
UserSchema.pre("save", async function (next) {
  if (!this.isModified("pin")) return next();
  // Only hash if the value looks like a raw 4-digit PIN (not already hashed)
  if (/^\d{4}$/.test(this.pin)) {
    this.pin = await bcrypt.hash(this.pin, BCRYPT_ROUNDS);
  }
  next();
});

/**
 * Compare a candidate PIN against the stored hash.
 */
UserSchema.methods.comparePin = async function (candidatePin) {
  return bcrypt.compare(candidatePin, this.pin);
};

/**
 * Static helper: find a user by raw PIN (checks all active users).
 * Because PINs are hashed, we can't query directly — we iterate.
 * With only ~200 users max this is acceptable for emergency auth.
 */
UserSchema.statics.findByPin = async function (rawPin, filter = {}) {
  const users = await this.find({ isActive: true, ...filter });
  for (const user of users) {
    const match = await bcrypt.compare(rawPin, user.pin);
    if (match) return user;
  }
  return null;
};

const User = mongoose.model("User", UserSchema);

export default User;

import mongoose from "mongoose";

const volunteerMessageSchema = new mongoose.Schema(
  {
    // Legacy field for backward compatibility
    volunteerId: {
      type: String,
    },
    // New two-way messaging fields
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    senderRole: {
      type: String,
      enum: ["manager", "volunteer"],
      required: true,
    },
    text: {
      type: String,
      required: true,
    },
    // Legacy field kept for compatibility
    sender: {
      type: String,
      default: "Manager",
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    readAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for faster lookups
volunteerMessageSchema.index({ senderId: 1, receiverId: 1 });
volunteerMessageSchema.index({ receiverId: 1, isRead: 1 });
volunteerMessageSchema.index({ createdAt: -1 });

const VolunteerMessage = mongoose.model("VolunteerMessage", volunteerMessageSchema);

export default VolunteerMessage;

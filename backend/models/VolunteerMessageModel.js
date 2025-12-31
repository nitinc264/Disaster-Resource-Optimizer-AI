import mongoose from "mongoose";

const volunteerMessageSchema = new mongoose.Schema(
  {
    volunteerId: {
      type: String,
      required: true,
    },
    text: {
      type: String,
      required: true,
    },
    sender: {
      type: String,
      required: true,
      default: "Manager",
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

const VolunteerMessage = mongoose.model("VolunteerMessage", volunteerMessageSchema);

export default VolunteerMessage;

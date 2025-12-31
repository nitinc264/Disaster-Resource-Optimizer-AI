import { sendSuccess, sendError } from "../utils/apiResponse.js";
import VolunteerMessage from "../models/VolunteerMessageModel.js";

export const sendVolunteerMessage = async (req, res) => {
  try {
    const { volunteerId, text, sender } = req.body;

    if (!volunteerId || !text) {
      return sendError(res, "Volunteer ID and text are required", 400);
    }

    const newMessage = new VolunteerMessage({
      volunteerId,
      text,
      sender: sender || "Manager",
    });

    await newMessage.save();

    return sendSuccess(res, newMessage, "Message sent successfully", 201);
  } catch (error) {
    console.error("Error sending volunteer message:", error);
    return sendError(res, "Internal server error", 500, error.message);
  }
};

export const getVolunteerMessages = async (req, res) => {
  try {
    const { volunteerId } = req.params;
    const messages = await VolunteerMessage.find({ volunteerId }).sort({ createdAt: -1 });
    return sendSuccess(res, messages, "Messages retrieved successfully");
  } catch (error) {
    console.error("Error retrieving volunteer messages:", error);
    return sendError(res, "Internal server error", 500, error.message);
  }
};

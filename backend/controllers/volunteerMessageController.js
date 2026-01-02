import { sendSuccess, sendError } from "../utils/apiResponse.js";
import VolunteerMessage from "../models/VolunteerMessageModel.js";
import User from "../models/UserModel.js";

/**
 * Send a message (Manager -> Volunteer or Volunteer -> Manager)
 */
export const sendVolunteerMessage = async (req, res) => {
  try {
    const { volunteerId, text, sender, receiverId } = req.body;
    const senderId = req.user._id;
    const senderRole = req.user.role;

    if (!text) {
      return sendError(res, "Message text is required", 400);
    }

    let targetReceiverId = receiverId;

    // For backward compatibility: if volunteerId is provided (manager sending to volunteer)
    if (volunteerId && !receiverId) {
      targetReceiverId = volunteerId;
    }

    // If volunteer is sending, find a manager to send to
    if (senderRole === "volunteer" && !targetReceiverId) {
      const manager = await User.findOne({ role: "manager", isActive: true });
      if (!manager) {
        return sendError(res, "No active manager found", 400);
      }
      targetReceiverId = manager._id;
    }

    if (!targetReceiverId) {
      return sendError(res, "Receiver is required", 400);
    }

    const newMessage = new VolunteerMessage({
      senderId,
      receiverId: targetReceiverId,
      senderRole,
      volunteerId: senderRole === "manager" ? targetReceiverId : senderId,
      text,
      sender: sender || (senderRole === "manager" ? "Manager" : "Volunteer"),
      isRead: false,
    });

    await newMessage.save();

    // Populate sender info for response
    const populatedMessage = await VolunteerMessage.findById(newMessage._id)
      .populate("senderId", "name role")
      .populate("receiverId", "name role");

    return sendSuccess(res, populatedMessage, "Message sent successfully", 201);
  } catch (error) {
    console.error("Error sending volunteer message:", error);
    return sendError(res, "Internal server error", 500, error.message);
  }
};

/**
 * Get messages for a specific volunteer (Manager view - backward compatible)
 */
export const getVolunteerMessages = async (req, res) => {
  try {
    const { volunteerId } = req.params;
    const messages = await VolunteerMessage.find({ volunteerId })
      .populate("senderId", "name role")
      .populate("receiverId", "name role")
      .sort({ createdAt: -1 });
    return sendSuccess(res, messages, "Messages retrieved successfully");
  } catch (error) {
    console.error("Error retrieving volunteer messages:", error);
    return sendError(res, "Internal server error", 500, error.message);
  }
};

/**
 * Get conversation between two users
 */
export const getConversation = async (req, res) => {
  try {
    const userId = req.user._id;
    const { partnerId } = req.params;

    const messages = await VolunteerMessage.find({
      $or: [
        { senderId: userId, receiverId: partnerId },
        { senderId: partnerId, receiverId: userId },
      ],
    })
      .populate("senderId", "name role")
      .populate("receiverId", "name role")
      .sort({ createdAt: 1 });

    return sendSuccess(res, messages, "Conversation retrieved successfully");
  } catch (error) {
    console.error("Error retrieving conversation:", error);
    return sendError(res, "Internal server error", 500, error.message);
  }
};

/**
 * Get all conversations for the current user
 */
export const getMyConversations = async (req, res) => {
  try {
    const userId = req.user._id;

    // Get all unique conversation partners
    const messages = await VolunteerMessage.aggregate([
      {
        $match: {
          $or: [{ senderId: userId }, { receiverId: userId }],
        },
      },
      {
        $sort: { createdAt: -1 },
      },
      {
        $group: {
          _id: {
            $cond: [{ $eq: ["$senderId", userId] }, "$receiverId", "$senderId"],
          },
          lastMessage: { $first: "$$ROOT" },
          unreadCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$receiverId", userId] },
                    { $eq: ["$isRead", false] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);

    // Populate partner info
    const partnerIds = messages.map((m) => m._id);
    const partners = await User.find({ _id: { $in: partnerIds } }).select(
      "name role phone email"
    );

    const partnersMap = {};
    partners.forEach((p) => {
      partnersMap[p._id.toString()] = p;
    });

    const conversations = messages.map((m) => ({
      partner: partnersMap[m._id.toString()],
      lastMessage: m.lastMessage,
      unreadCount: m.unreadCount,
    }));

    return sendSuccess(res, conversations, "Conversations retrieved successfully");
  } catch (error) {
    console.error("Error retrieving conversations:", error);
    return sendError(res, "Internal server error", 500, error.message);
  }
};

/**
 * Get unread message count for current user
 */
export const getUnreadCount = async (req, res) => {
  try {
    const userId = req.user._id;

    const count = await VolunteerMessage.countDocuments({
      receiverId: userId,
      isRead: false,
    });

    return sendSuccess(res, { unreadCount: count }, "Unread count retrieved");
  } catch (error) {
    console.error("Error getting unread count:", error);
    return sendError(res, "Internal server error", 500, error.message);
  }
};

/**
 * Mark messages as read
 */
export const markMessagesAsRead = async (req, res) => {
  try {
    const userId = req.user._id;
    const { partnerId } = req.params;

    await VolunteerMessage.updateMany(
      {
        senderId: partnerId,
        receiverId: userId,
        isRead: false,
      },
      {
        $set: { isRead: true, readAt: new Date() },
      }
    );

    return sendSuccess(res, null, "Messages marked as read");
  } catch (error) {
    console.error("Error marking messages as read:", error);
    return sendError(res, "Internal server error", 500, error.message);
  }
};

/**
 * Get all managers (for volunteers to message)
 */
export const getManagers = async (req, res) => {
  try {
    const managers = await User.find({ role: "manager", isActive: true }).select(
      "name phone email"
    );
    return sendSuccess(res, managers, "Managers retrieved successfully");
  } catch (error) {
    console.error("Error retrieving managers:", error);
    return sendError(res, "Internal server error", 500, error.message);
  }
};

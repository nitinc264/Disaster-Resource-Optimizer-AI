import express from "express";
import {
  sendVolunteerMessage,
  getVolunteerMessages,
  getConversation,
  getMyConversations,
  getUnreadCount,
  markMessagesAsRead,
  getManagers,
} from "../controllers/volunteerMessageController.js";
import { requireManager, requireAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

// Manager-only routes (backward compatible)
router.post("/volunteer-messages", requireManager, sendVolunteerMessage);
router.get("/volunteer-messages/:volunteerId", requireManager, getVolunteerMessages);

// Two-way messaging routes (authenticated users)
router.post("/messages/send", requireAuth, sendVolunteerMessage);
router.get("/messages/conversations", requireAuth, getMyConversations);
router.get("/messages/conversation/:partnerId", requireAuth, getConversation);
router.get("/messages/unread-count", requireAuth, getUnreadCount);
router.put("/messages/read/:partnerId", requireAuth, markMessagesAsRead);
router.get("/messages/managers", requireAuth, getManagers);

export default router;

import express from "express";
import { sendVolunteerMessage, getVolunteerMessages } from "../controllers/volunteerMessageController.js";
import { requireManager } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/volunteer-messages", requireManager, sendVolunteerMessage);
router.get("/volunteer-messages/:volunteerId", requireManager, getVolunteerMessages);

export default router;

import express from "express";
import {
  getTwilioWebhookValidator,
  handleIncomingSms,
} from "../controllers/emergencySmsController.js";

const router = express.Router();

router.post("/sms", getTwilioWebhookValidator(), handleIncomingSms);

export default router;

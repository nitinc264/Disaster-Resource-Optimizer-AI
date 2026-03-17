import express from "express";
import {
  getWhatsAppWebhookValidator,
  handleIncomingWhatsApp,
} from "../controllers/whatsappController.js";

const router = express.Router();

// Twilio WhatsApp webhook endpoint
// Configure this URL in Twilio Console → Messaging → WhatsApp Sandbox/Sender
// Webhook URL: https://your-domain.com/api/whatsapp
router.post(
  "/whatsapp",
  getWhatsAppWebhookValidator(),
  handleIncomingWhatsApp,
);

export default router;

// File: routes/smsWebhook.js

import express from 'express';
import twilio from 'twilio';
import { triageSMS } from '../services/geminiService.js';
import Need from '../models/Need.js';

const router = express.Router();

// Initialize the Twilio client
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const MessagingResponse = twilio.twiml.MessagingResponse;

/**
 * @route   POST /api/sms
 * @desc    Receives incoming SMS from citizens via Twilio Webhook
 * @access  Public
 */
router.post(
  '/sms',
  // Twilio validation middleware (optional but recommended for production)
  // This ensures the request is actually from Twilio
  twilio.webhook({ validate: process.env.NODE_ENV === 'production' }),

  async (req, res) => {
    // 1. Extract data from Twilio's payload
    const fromNumber = req.body.From; // The citizen's phone number
    const rawMessage = req.body.Body; // The raw SMS text (e.g., "HELP!")

    console.log(`Incoming message from ${fromNumber}: "${rawMessage}"`);

    try {
      // 2. Send the raw message to the Gemini AI for triage
      const triageData = await triageSMS(rawMessage);
      console.log('Gemini Triage Result:', triageData);

      // 3. Create and save the new Need report in MongoDB
      const newNeed = new Need({
        fromNumber,
        rawMessage,
        triageData, // This is the nested object { needType, location, ... }
        status: 'Unverified',
      });

      await newNeed.save();
      console.log(`New need saved to DB with ID: ${newNeed._id}`);

      // 4. Send a confirmation SMS back to the citizen
      const twiml = new MessagingResponse();
      twiml.message(
        `Your request has been received and logged. 
A volunteer will verify it soon. 
Your Report ID: ${newNeed._id}`
      );

      // 5. Send the TwiML response back to Twilio
      res.writeHead(200, { 'Content-Type': 'text/xml' });
      res.end(twiml.toString());

    } catch (error) {
      console.error('Error in /api/sms webhook:', error);
      
      // Send a failure message back to the user
      const twiml = new MessagingResponse();
      twiml.message('We apologize, there was an error processing your request. Please try again.');
      
      res.writeHead(500, { 'Content-Type': 'text/xml' });
      res.end(twiml.toString());
    }
  }
);

export default router;

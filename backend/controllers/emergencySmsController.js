import twilio from "twilio";
import config from "../config/index.js";
import { triageSMS } from "../services/geminiService.js";
import { geocodeLocation } from "../services/addressGeocodingService.js";
import Need from "../models/NeedModel.js";
import { fallbackTriage, extractLocationHint } from "../utils/textParser.js";
import { logger } from "../utils/appLogger.js";
import { STATUS } from "../constants/index.js";

const MessagingResponse = twilio.twiml.MessagingResponse;

/**
 * Get Twilio webhook validator middleware
 */
export function getTwilioWebhookValidator() {
  return twilio.webhook({ validate: config.twilio.validateWebhook });
}

/**
 * Build triage data from raw message using AI or fallback parser
 */
async function buildTriageData(rawMessage) {
  try {
    const triageData = await triageSMS(rawMessage);
    logger.debug("Triage data created using Gemini AI");
    return triageData;
  } catch (error) {
    logger.warn("Gemini failed, using fallback parser:", error.message);
    const fallback = fallbackTriage(rawMessage);
    return fallback;
  }
}

/**
 * Resolve coordinates from location mentioned in message
 */
async function resolveCoordinates(triageData, rawMessage) {
  const triagedLocation =
    triageData?.location && triageData.location !== "Unknown"
      ? triageData.location
      : null;
  const fallbackLocation = extractLocationHint(rawMessage);
  const locationQuery = triagedLocation || fallbackLocation;

  if (!locationQuery) {
    logger.debug("No location found in message");
    return null;
  }

  try {
    const coordinates = await geocodeLocation(locationQuery);
    logger.debug(`Geocoded location: ${locationQuery}`);
    return coordinates;
  } catch (error) {
    logger.warn(`Failed to geocode location: ${locationQuery}`, error.message);
    return null;
  }
}

/**
 * Send Twilio TwiML response
 */
function respondWithMessage(res, statusCode, message) {
  const twiml = new MessagingResponse();
  twiml.message(message);
  res.writeHead(statusCode, { "Content-Type": "text/xml" });
  res.end(twiml.toString());
}

/**
 * POST /api/sms
 * Handle incoming SMS from Twilio webhook
 */
export async function handleIncomingSms(req, res) {
  const fromNumber = req.body.From;
  const rawMessage = req.body.Body;

  logger.info(`Incoming SMS from ${fromNumber}: "${rawMessage}"`);

  try {
    const triageData = await buildTriageData(rawMessage);
    const coordinates = await resolveCoordinates(triageData, rawMessage);

    const newNeed = new Need({
      fromNumber,
      rawMessage,
      triageData,
      status: STATUS.UNVERIFIED,
      coordinates,
    });

    await newNeed.save();
    logger.info(`New need saved to DB with ID: ${newNeed._id}`);

    respondWithMessage(
      res,
      200,
      `Your request has been received and logged. \nA volunteer will verify it soon. \nYour Report ID: ${newNeed._id}`
    );
  } catch (error) {
    logger.error("Error in SMS webhook:", error);

    respondWithMessage(
      res,
      500,
      "We apologize, there was an error processing your request. Please try again."
    );
  }
}

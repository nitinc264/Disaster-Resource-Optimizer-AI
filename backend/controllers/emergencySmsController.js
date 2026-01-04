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
 * Check if user has a pending need without location and update it
 */
async function checkAndUpdatePendingNeed(fromNumber, rawMessage) {
  // Find the most recent need from this number that needs location
  const pendingNeed = await Need.findOne({
    fromNumber,
    coordinates: null,
    verificationNotes: { $regex: /LOCATION_REQUIRED/i },
    status: STATUS.UNVERIFIED,
  }).sort({ createdAt: -1 });

  if (!pendingNeed) {
    return null;
  }

  // Try to geocode the new message as a location
  const coordinates = await geocodeLocation(rawMessage);

  if (coordinates && coordinates.lat && coordinates.lon) {
    // Update the pending need with the new location
    pendingNeed.coordinates = coordinates;
    pendingNeed.verificationNotes = pendingNeed.verificationNotes.replace(
      "LOCATION_REQUIRED: User needs to provide location",
      `Location provided via follow-up SMS: ${rawMessage}`
    );
    await pendingNeed.save();

    logger.info(`Updated pending need ${pendingNeed._id} with location from follow-up SMS`);
    return pendingNeed;
  }

  return null;
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
    // First, check if this is a follow-up message providing location
    const updatedNeed = await checkAndUpdatePendingNeed(fromNumber, rawMessage);
    
    if (updatedNeed) {
      respondWithMessage(
        res,
        200,
        `✅ Thank you! Your location has been updated.\n\nYour Report ID: ${updatedNeed._id}\nLocation: ${updatedNeed.coordinates.formattedAddress || rawMessage}\n\nA volunteer will verify your request soon.`
      );
      return;
    }

    const triageData = await buildTriageData(rawMessage);
    const coordinates = await resolveCoordinates(triageData, rawMessage);

    // Check if location could be determined
    if (!coordinates || !coordinates.lat || !coordinates.lon) {
      logger.warn(`Could not determine location for SMS from ${fromNumber}`);
      
      // Save the need anyway but with a flag indicating location is needed
      const newNeed = new Need({
        fromNumber,
        rawMessage,
        triageData,
        status: STATUS.UNVERIFIED,
        coordinates: null,
        verificationNotes: "LOCATION_REQUIRED: User needs to provide location",
      });

      await newNeed.save();
      logger.info(`Need saved without location, ID: ${newNeed._id}`);

      // Prompt user to provide their location
      respondWithMessage(
        res,
        200,
        `Your emergency has been received (ID: ${newNeed._id}).\n\n⚠️ We could not determine your location.\n\nPlease reply with your LOCATION (landmark, street name, area) so we can send help quickly.\n\nExample: "Near City Hospital, MG Road" or "Shivaji Nagar Bus Stand"`
      );
      return;
    }

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

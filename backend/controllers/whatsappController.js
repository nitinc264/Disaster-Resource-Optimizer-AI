import twilio from "twilio";
import fetch from "node-fetch";
import config from "../config/index.js";
import { triageSMS } from "../services/geminiService.js";
import { geocodeLocation } from "../services/addressGeocodingService.js";
import { uploadImageBuffer } from "../services/cloudinaryService.js";
import Need from "../models/NeedModel.js";
import Report from "../models/ReportModel.js";
import { fallbackTriage, extractLocationHint } from "../utils/textParser.js";
import { logger } from "../utils/appLogger.js";
import { STATUS } from "../constants/index.js";
import {
  findDuplicateCluster,
  linkToCluster,
} from "../services/deduplicationService.js";

const MessagingResponse = twilio.twiml.MessagingResponse;

/**
 * Get Twilio webhook validator middleware for WhatsApp
 */
export function getWhatsAppWebhookValidator() {
  return twilio.webhook({ validate: config.twilio.validateWebhook });
}

/**
 * Clean WhatsApp phone number prefix (whatsapp:+91xxx -> +91xxx)
 */
function cleanWhatsAppNumber(waNumber) {
  return waNumber ? waNumber.replace(/^whatsapp:/, "") : waNumber;
}

/**
 * Send TwiML response back to WhatsApp user
 */
function respondWithMessage(res, statusCode, message) {
  const twiml = new MessagingResponse();
  twiml.message(message);
  res.writeHead(statusCode, { "Content-Type": "text/xml" });
  res.end(twiml.toString());
}

/**
 * Download media from Twilio URL (requires auth for WhatsApp media)
 */
async function downloadTwilioMedia(mediaUrl) {
  const accountSid = config.twilio.accountSid;
  const authToken = config.twilio.authToken;

  if (!accountSid || !authToken) {
    throw new Error("Twilio credentials required to download WhatsApp media");
  }

  const authHeader = Buffer.from(`${accountSid}:${authToken}`).toString(
    "base64",
  );

  const response = await fetch(mediaUrl, {
    headers: { Authorization: `Basic ${authHeader}` },
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(
      `Failed to download media: ${response.status} ${response.statusText}`,
    );
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const contentType = response.headers.get("content-type") || "image/jpeg";

  return { buffer, contentType };
}

/**
 * Build triage data from raw message using AI or fallback parser
 */
async function buildTriageData(rawMessage) {
  try {
    const triageData = await triageSMS(rawMessage);
    logger.debug("WhatsApp triage data created using Gemini AI");
    return triageData;
  } catch (error) {
    logger.warn("Gemini failed for WhatsApp, using fallback parser:", error.message);
    return fallbackTriage(rawMessage);
  }
}

/**
 * Resolve coordinates from triage data or raw message
 */
async function resolveCoordinates(triageData, rawMessage) {
  const triagedLocation =
    triageData?.location && triageData.location !== "Unknown"
      ? triageData.location
      : null;
  const fallbackLocation = extractLocationHint(rawMessage);
  const locationQuery = triagedLocation || fallbackLocation;

  if (!locationQuery) return null;

  try {
    const coordinates = await geocodeLocation(locationQuery);
    return coordinates;
  } catch (error) {
    logger.warn(`WhatsApp geocode failed: ${locationQuery}`, error.message);
    return null;
  }
}

/**
 * Check if user has a pending need without location and update it
 */
async function checkAndUpdatePendingNeed(fromNumber, rawMessage, waCoords) {
  const pendingNeed = await Need.findOne({
    fromNumber,
    coordinates: null,
    verificationNotes: { $regex: /LOCATION_REQUIRED/i },
    status: STATUS.UNVERIFIED,
  }).sort({ createdAt: -1 });

  if (!pendingNeed) return null;

  // WhatsApp native location takes priority
  let coordinates = null;
  if (waCoords) {
    coordinates = {
      lat: waCoords.lat,
      lng: waCoords.lng,
      formattedAddress: `WhatsApp shared location (${waCoords.lat.toFixed(4)}, ${waCoords.lng.toFixed(4)})`,
    };
  } else {
    coordinates = await geocodeLocation(rawMessage);
  }

  if (coordinates && coordinates.lat && coordinates.lng) {
    pendingNeed.coordinates = coordinates;
    pendingNeed.verificationNotes = pendingNeed.verificationNotes.replace(
      "LOCATION_REQUIRED: User needs to provide location",
      `Location provided via WhatsApp: ${coordinates.formattedAddress || rawMessage}`,
    );
    await pendingNeed.save();

    logger.info(
      `Updated pending need ${pendingNeed._id} with location from WhatsApp follow-up`,
    );
    return pendingNeed;
  }

  return null;
}

/**
 * Handle WhatsApp image message — creates a Report (feeds into Sentinel + Oracle pipeline)
 */
async function handleImageMessage(req, fromNumber, rawMessage) {
  const numMedia = parseInt(req.body.NumMedia || "0", 10);
  if (numMedia === 0) return null;

  const mediaUrl = req.body.MediaUrl0;
  const mediaType = req.body.MediaContentType0 || "";

  // Only process images
  if (!mediaType.startsWith("image/")) return null;

  logger.info(
    `WhatsApp image received from ${fromNumber} (type: ${mediaType})`,
  );

  // Extract WhatsApp location if sent alongside image
  const lat = parseFloat(req.body.Latitude);
  const lng = parseFloat(req.body.Longitude);
  let coords = null;

  if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
    coords = { lat, lng };
  }

  // If no native location, try to geocode from message text
  if (!coords && rawMessage) {
    const geocoded = await resolveCoordinates(
      await buildTriageData(rawMessage),
      rawMessage,
    );
    if (geocoded) {
      coords = { lat: geocoded.lat, lng: geocoded.lng };
    }
  }

  // Default to Pune center if no location available
  const DEFAULT_LAT = 18.5204;
  const DEFAULT_LNG = 73.8567;
  let usedDefaultLocation = false;

  if (!coords) {
    coords = { lat: DEFAULT_LAT, lng: DEFAULT_LNG };
    usedDefaultLocation = true;
    logger.warn("WhatsApp image: no location found, using Pune default");
  }

  // Download image from Twilio and upload to Cloudinary
  let uploadResult;
  try {
    const { buffer } = await downloadTwilioMedia(mediaUrl);
    uploadResult = await uploadImageBuffer(buffer, {
      folder:
        process.env.CLOUDINARY_FOLDER || "disaster-response/reports/whatsapp",
    });
  } catch (uploadError) {
    logger.error("WhatsApp image upload failed:", uploadError.message);
    return {
      error: true,
      message:
        "We received your image but had trouble processing it. Please try sending it again or describe the emergency in text.",
    };
  }

  // Create Report (goes through Sentinel -> Oracle pipeline automatically)
  const report = new Report({
    source: "WhatsApp",
    text: rawMessage || null,
    imageUrl: uploadResult.secure_url,
    location: {
      lat: coords.lat,
      lng: coords.lng,
      isApproximate: usedDefaultLocation,
    },
    status: "Pending",
    timestamp: new Date(),
  });

  const savedReport = await report.save();

  logger.info(
    `WhatsApp photo report created: ${savedReport._id} (image: ${uploadResult.secure_url})`,
  );

  return {
    error: false,
    reportId: savedReport._id,
    usedDefaultLocation,
    imageUrl: uploadResult.secure_url,
  };
}

/**
 * POST /api/whatsapp
 * Handle incoming WhatsApp message from Twilio webhook
 *
 * WhatsApp-specific Twilio fields:
 *   - From: "whatsapp:+91XXXXXXXXXX"
 *   - Body: message text
 *   - NumMedia: number of media attachments
 *   - MediaUrl0, MediaContentType0: first attachment
 *   - Latitude, Longitude: native location share
 */
export async function handleIncomingWhatsApp(req, res) {
  const rawFrom = req.body.From; // whatsapp:+91xxx
  const fromNumber = cleanWhatsAppNumber(rawFrom);
  const rawMessage = req.body.Body || "";
  const numMedia = parseInt(req.body.NumMedia || "0", 10);

  // Extract native WhatsApp location (sent when user shares location)
  const waLat = parseFloat(req.body.Latitude);
  const waLng = parseFloat(req.body.Longitude);
  const hasNativeLocation =
    !isNaN(waLat) && !isNaN(waLng) && waLat !== 0 && waLng !== 0;

  logger.info(
    `Incoming WhatsApp from ${fromNumber}: "${rawMessage}" (media: ${numMedia}, location: ${hasNativeLocation})`,
  );

  try {
    // ─── STEP 1: Handle image messages (routes to Report pipeline) ───
    if (numMedia > 0) {
      const imageResult = await handleImageMessage(req, fromNumber, rawMessage);

      if (imageResult?.error) {
        respondWithMessage(res, 200, imageResult.message);
        return;
      }

      if (imageResult) {
        const locationNote = imageResult.usedDefaultLocation
          ? "\n\n📍 _We couldn't determine your exact location. Please share your live location or reply with your area name for faster help._"
          : "";

        respondWithMessage(
          res,
          200,
          `📸 *Photo report received!*\n\nYour Report ID: \`${imageResult.reportId}\`\n\nOur AI will analyze the image and dispatch help automatically.${locationNote}\n\n_You can also send a text message describing the emergency._`,
        );
        return;
      }
    }

    // ─── STEP 2: Handle pure location share (no text) ───
    if (hasNativeLocation && !rawMessage.trim()) {
      // Check if this is a follow-up providing location for a pending need
      const updatedNeed = await checkAndUpdatePendingNeed(fromNumber, "", {
        lat: waLat,
        lng: waLng,
      });

      if (updatedNeed) {
        respondWithMessage(
          res,
          200,
          `📍 *Location updated!*\n\nYour Report ID: \`${updatedNeed._id}\`\nLocation: ${updatedNeed.coordinates.formattedAddress}\n\nA volunteer will verify your request soon.`,
        );
        return;
      }

      // No pending need — acknowledge location but ask for details
      respondWithMessage(
        res,
        200,
        `📍 *Location received!*\n\nThank you for sharing your location. Now please describe the emergency:\n\n_Example: "Building collapsed, 5 people trapped" or "Flood water rising, need rescue"_`,
      );
      return;
    }

    // ─── STEP 3: Check for follow-up location message ───
    const waCoords = hasNativeLocation ? { lat: waLat, lng: waLng } : null;
    const updatedNeed = await checkAndUpdatePendingNeed(
      fromNumber,
      rawMessage,
      waCoords,
    );

    if (updatedNeed) {
      respondWithMessage(
        res,
        200,
        `📍 *Location updated!*\n\nYour Report ID: \`${updatedNeed._id}\`\nLocation: ${updatedNeed.coordinates.formattedAddress || rawMessage}\n\nA volunteer will verify your request soon.`,
      );
      return;
    }

    // ─── STEP 4: Process text message through AI triage (same as SMS) ───
    const triageData = await buildTriageData(rawMessage);

    // Prefer WhatsApp native location, fall back to geocoding
    let coordinates = null;
    if (hasNativeLocation) {
      coordinates = {
        lat: waLat,
        lng: waLng,
        formattedAddress: `WhatsApp location (${waLat.toFixed(4)}, ${waLng.toFixed(4)})`,
      };
      logger.info(
        `Using WhatsApp native location: ${waLat}, ${waLng}`,
      );
    } else {
      coordinates = await resolveCoordinates(triageData, rawMessage);
    }

    // Deduplication check
    const triageLocation = triageData?.location || null;
    const existingCluster = await findDuplicateCluster(
      coordinates,
      triageData.needType,
      rawMessage,
      triageLocation,
    );

    // ─── STEP 5: No coordinates and no cluster — ask for location ───
    if (
      (!coordinates || !coordinates.lat || !coordinates.lng) &&
      !existingCluster
    ) {
      logger.warn(
        `WhatsApp: Could not determine location from ${fromNumber}`,
      );

      const newNeed = new Need({
        fromNumber,
        rawMessage,
        triageData,
        status: STATUS.UNVERIFIED,
        coordinates: null,
        verificationNotes: "LOCATION_REQUIRED: User needs to provide location",
      });

      await newNeed.save();

      respondWithMessage(
        res,
        200,
        `🆘 *Emergency received!*\n\nReport ID: \`${newNeed._id}\`\nType: ${triageData.needType} | Urgency: ${triageData.urgency}\n\n⚠️ *We need your location to send help.*\n\nPlease:\n📍 Tap *Attach (+)* → *Location* → *Share Live Location*\n\n_Or reply with your area: "Near City Hospital, MG Road"_`,
      );
      return;
    }

    // ─── STEP 6: Save need ───
    const newNeed = new Need({
      fromNumber,
      rawMessage,
      triageData,
      status: STATUS.UNVERIFIED,
      coordinates,
    });

    if (existingCluster) {
      await newNeed.save();
      await linkToCluster(newNeed, existingCluster);

      const clusterSize = (existingCluster.duplicateCount || 0) + 2;
      respondWithMessage(
        res,
        200,
        `🔗 *Report merged with existing emergency*\n\nYour area already has *${clusterSize} reports* for this emergency.\nCluster ID: \`${existingCluster._id}\`\n\nHelp is being coordinated. Stay safe!`,
      );
      return;
    }

    // New primary need
    newNeed.clusterId = newNeed._id;
    await newNeed.save();

    const urgencyEmoji =
      triageData.urgency === "High"
        ? "🔴"
        : triageData.urgency === "Medium"
          ? "🟡"
          : "🟢";

    respondWithMessage(
      res,
      200,
      `🆘 *Emergency logged!*\n\nReport ID: \`${newNeed._id}\`\nType: ${triageData.needType}\nUrgency: ${urgencyEmoji} ${triageData.urgency}\n${coordinates?.formattedAddress ? `📍 ${coordinates.formattedAddress}` : ""}\n\nA volunteer will verify your request soon.\n\n_Send photos of the situation for faster response._`,
    );
  } catch (error) {
    logger.error("Error in WhatsApp webhook:", error);

    respondWithMessage(
      res,
      500,
      "We apologize, there was an error processing your message. Please try sending it again.",
    );
  }
}

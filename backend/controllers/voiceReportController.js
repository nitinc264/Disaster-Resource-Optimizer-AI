import fs from "fs";
import OpenAI from "openai";
import Report from "../models/ReportModel.js";
import config from "../config/index.js";
import { geocodeLocation } from "../services/addressGeocodingService.js";
import { sendSuccess, sendError } from "../utils/apiResponse.js";
import { logger } from "../utils/appLogger.js";
import { AI_MODELS, HTTP_STATUS } from "../constants/index.js";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: config.openaiApiKey,
});

/**
 * GET /api/reports
 * Get all reports with optional status filter
 */
export async function getAllReports(req, res) {
  try {
    const { status, limit = 50 } = req.query;

    const query = {};
    if (status) {
      query.status = status;
    }

    const reports = await Report.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    // Transform reports for frontend
    const transformedReports = reports.map((report) => ({
      id: report.reportId,
      reportId: report.reportId,
      source: report.source,
      text: report.text,
      status: report.status,
      emergencyStatus: report.emergencyStatus || "none",
      emergencyAlertId: report.emergencyAlertId,
      assignedStation: report.assignedStation,
      location: report.location,
      lat: report.location?.lat,
      lon: report.location?.lng,
      tag: report.sentinelData?.tag,
      severity: report.oracleData?.severity,
      needs: report.oracleData?.needs || [],
      confidence: report.sentinelData?.confidence,
      transcription: report.audioData?.transcription,
      createdAt: report.createdAt,
      updatedAt: report.updatedAt,
    }));

    sendSuccess(res, transformedReports, "Reports fetched successfully");
  } catch (error) {
    logger.error("Error fetching reports:", error);
    sendError(
      res,
      "Failed to fetch reports",
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      error.message
    );
  }
}

/**
 * GET /api/reports/:id
 * Get a specific report by ID
 */
export async function getReportById(req, res) {
  try {
    const { id } = req.params;

    const report = await Report.findOne({ reportId: id });

    if (!report) {
      return sendError(res, "Report not found", HTTP_STATUS.NOT_FOUND);
    }

    const transformedReport = {
      id: report.reportId,
      reportId: report.reportId,
      source: report.source,
      text: report.text,
      status: report.status,
      emergencyStatus: report.emergencyStatus || "none",
      emergencyAlertId: report.emergencyAlertId,
      assignedStation: report.assignedStation,
      location: report.location,
      lat: report.location?.lat,
      lon: report.location?.lng,
      tag: report.sentinelData?.tag,
      severity: report.oracleData?.severity,
      needs: report.oracleData?.needs || [],
      confidence: report.sentinelData?.confidence,
      transcription: report.audioData?.transcription,
      createdAt: report.createdAt,
      updatedAt: report.updatedAt,
    };

    sendSuccess(res, transformedReport, "Report fetched successfully");
  } catch (error) {
    logger.error("Error fetching report:", error);
    sendError(
      res,
      "Failed to fetch report",
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      error.message
    );
  }
}

/**
 * Mock function to analyze transcribed text using Gemini
 * This will be replaced with actual Gemini integration
 * @param {string} text - The transcribed text from Whisper
 * @returns {Promise<Object>} Analysis results
 */
async function analyzeTextWithGemini(text) {
  // TODO: Replace this mock with actual Gemini API call
  // For now, return a mock analysis based on keywords

  const textLower = text.toLowerCase();

  // Simple keyword-based analysis (to be replaced with Gemini)
  let severity = 5;
  let tag = "Other";
  let needs = [];

  // Urgency keywords
  if (
    textLower.includes("emergency") ||
    textLower.includes("urgent") ||
    textLower.includes("critical") ||
    textLower.includes("trapped") ||
    textLower.includes("dying")
  ) {
    severity = 9;
  } else if (
    textLower.includes("help") ||
    textLower.includes("need") ||
    textLower.includes("please")
  ) {
    severity = 7;
  }

  // Need type detection
  if (
    textLower.includes("water") ||
    textLower.includes("thirsty") ||
    textLower.includes("drink")
  ) {
    tag = "Water";
    needs.push("Water");
  }

  if (
    textLower.includes("food") ||
    textLower.includes("hungry") ||
    textLower.includes("eat")
  ) {
    tag = "Food";
    needs.push("Food");
  }

  if (
    textLower.includes("medical") ||
    textLower.includes("doctor") ||
    textLower.includes("medicine") ||
    textLower.includes("injured") ||
    textLower.includes("sick")
  ) {
    tag = "Medical";
    needs.push("Medical");
    severity = Math.max(severity, 8);
  }

  if (
    textLower.includes("rescue") ||
    textLower.includes("trapped") ||
    textLower.includes("stuck") ||
    textLower.includes("help")
  ) {
    tag = "Rescue";
    needs.push("Rescue");
    severity = Math.max(severity, 9);
  }

  if (needs.length === 0) {
    needs.push("Other");
  }

  return {
    tag,
    confidence: 0.75, // Mock confidence score
    severity,
    needs,
  };
}

/**
 * Process audio report: transcribe and analyze
 * POST /api/reports/audio
 */
export async function processAudioReport(req, res) {
  let tempFilePath = null;

  try {
    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({
        error: "No audio file uploaded",
        message: "Please upload an audio file (.webm, .mp3, .m4a, .wav)",
      });
    }

    // Check for required location data
    const { lat, lng } = req.body;
    if (!lat || !lng) {
      // Clean up uploaded file
      if (req.file.path) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({
        error: "Missing location data",
        message: "Latitude (lat) and longitude (lng) are required",
      });
    }

    tempFilePath = req.file.path;

    // Step 1: Create Report with 'Processing_Audio' status
    const report = new Report({
      source: "Audio",
      audioUrl: req.file.filename, // Store the filename
      location: {
        lat: parseFloat(lat),
        lng: parseFloat(lng),
      },
      status: "Processing_Audio",
    });

    await report.save();

    // Step 2: Try to transcribe audio using OpenAI Whisper
    let transcription = null;
    let transcriptionError = null;

    try {
      transcription = await openai.audio.transcriptions.create({
        file: fs.createReadStream(tempFilePath),
        model: AI_MODELS.WHISPER,
        language: "en", // Optional: specify language or let it auto-detect
        response_format: "text",
      });
      logger.debug("Audio transcription completed successfully");
    } catch (whisperError) {
      logger.error("Whisper API error:", whisperError.message);
      transcriptionError = whisperError.message;

      // Check if it's a quota error
      if (
        whisperError.status === 429 ||
        whisperError.message?.includes("quota")
      ) {
        logger.warn(
          "OpenAI quota exceeded - saving report for later processing"
        );
      }
    }

    // If transcription succeeded, analyze it
    let analysis = null;
    if (transcription) {
      // Step 3: Analyze transcription with Gemini (mock for now)
      analysis = await analyzeTextWithGemini(transcription);
    }

    // Step 4: Update Report with available data
    if (transcription) {
      report.audioData = {
        transcription: transcription,
      };
      report.text = transcription;
    } else {
      report.audioData = {
        transcription: null,
        processingError: transcriptionError,
      };
    }

    if (analysis) {
      report.sentinelData = {
        tag: analysis.tag,
        confidence: analysis.confidence,
      };

      report.oracleData = {
        severity: analysis.severity,
        needs: analysis.needs,
      };

      report.status = "Analyzed";
    } else {
      // Keep audio file for later processing
      report.status = "Pending_Transcription";
      report.sentinelData = {
        tag: "Pending",
        confidence: 0,
      };
      report.oracleData = {
        severity: 5,
        needs: ["Unknown"],
      };
    }

    await report.save();

    // Step 5: Clean up temporary file only if transcription succeeded
    if (transcription && fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    } else if (!transcription) {
      console.log("⚠️ Keeping audio file for later processing");
    }

    // Step 6: Return success response
    const responseMessage = transcription
      ? "Audio report processed successfully"
      : "Audio report saved. Transcription will be processed when API quota is available.";

    res.status(201).json({
      success: true,
      message: responseMessage,
      pending: !transcription,
      report: {
        reportId: report.reportId,
        transcription: report.audioData?.transcription || null,
        analysis: analysis
          ? {
              tag: report.sentinelData.tag,
              confidence: report.sentinelData.confidence,
              severity: report.oracleData.severity,
              needs: report.oracleData.needs,
            }
          : null,
        location: report.location,
        status: report.status,
        createdAt: report.createdAt,
      },
    });
  } catch (error) {
    console.error("Error processing audio report:", error);

    // Clean up temporary file on error (but not for quota errors)
    const isQuotaError =
      error.status === 429 || error.message?.includes("quota");

    if (tempFilePath && fs.existsSync(tempFilePath) && !isQuotaError) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch (unlinkError) {
        console.error("Error deleting temporary file:", unlinkError);
      }
    }

    // Handle specific OpenAI errors
    if (error.code === "invalid_api_key") {
      return res.status(500).json({
        error: "OpenAI API key is invalid or missing",
        message: "Please configure OPENAI_API_KEY in environment variables",
      });
    }

    if (error.message?.includes("audio")) {
      return res.status(400).json({
        error: "Audio processing failed",
        message: error.message,
      });
    }

    // Generic error response
    res.status(500).json({
      error: "Failed to process audio report",
      message: error.message || "An unexpected error occurred",
    });
  }
}

/**
 * POST /api/reports
 * Create a new text-based report (e.g. from PWA offline sync)
 */
export async function createReport(req, res) {
  try {
    const { message, severity, location, source, id, timestamp } = req.body;

    logger.info(`Received report: ${message} from ${location}`);

    // 1. Map Severity String to Number
    let severityScore = 5;
    const severityMap = {
      low: 3,
      medium: 5,
      high: 8,
      critical: 10,
    };
    if (severity && severityMap[severity.toLowerCase()]) {
      severityScore = severityMap[severity.toLowerCase()];
    }

    // 2. Geocode Location
    let coords = { lat: 0, lng: 0 };
    if (location) {
      const geoResult = await geocodeLocation(location);
      if (geoResult) {
        coords = { lat: geoResult.lat, lng: geoResult.lon };
      }
    }

    // 3. Map Source
    let reportSource = "PWA";
    if (source === "manual") reportSource = "PWA";
    else if (["SMS", "WhatsApp", "Audio"].includes(source))
      reportSource = source;

    // 4. Create Report
    const report = new Report({
      reportId: id || undefined, // Use provided ID if syncing, else auto-generate
      source: reportSource,
      text: message,
      location: coords,
      status: "Pending",
      oracleData: {
        severity: severityScore,
        needs: [], // Could extract needs from text using simple keyword matching here too
      },
      timestamp: timestamp ? new Date(timestamp) : new Date(),
    });

    await report.save();
    logger.info(`Report saved: ${report.reportId}`);

    sendSuccess(
      res,
      { reportId: report.reportId },
      "Report created successfully",
      HTTP_STATUS.CREATED
    );
  } catch (error) {
    logger.error("Error creating report:", error);
    sendError(
      res,
      "Failed to create report",
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      error.message
    );
  }
}

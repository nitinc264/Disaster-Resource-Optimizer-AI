import fs from "fs";
import fsp from "fs/promises";
import OpenAI from "openai";
import Report from "../models/ReportModel.js";
import config from "../config/index.js";
import { geocodeLocation } from "../services/addressGeocodingService.js";
import { analyzeTranscription } from "../services/geminiService.js";
import { sendSuccess, sendError } from "../utils/apiResponse.js";
import { logger } from "../utils/appLogger.js";
import { AI_MODELS, HTTP_STATUS } from "../constants/index.js";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: config.openaiApiKey,
});

/** Maximum number of reports returned per query */
const MAX_REPORT_LIMIT = 500;

/**
 * Transform a report document into frontend-friendly format
 */
function transformReport(report) {
  return {
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
}

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

    const parsedLimit = Math.min(
      Math.max(parseInt(limit, 10) || 50, 1),
      MAX_REPORT_LIMIT,
    );

    const reports = await Report.find(query)
      .sort({ createdAt: -1 })
      .limit(parsedLimit);

    const transformedReports = reports.map(transformReport);

    sendSuccess(res, transformedReports, "Reports fetched successfully");
  } catch (error) {
    logger.error("Error fetching reports:", error);
    sendError(
      res,
      "Failed to fetch reports",
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      error.message,
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

    const transformedReport = transformReport(report);

    sendSuccess(res, transformedReport, "Report fetched successfully");
  } catch (error) {
    logger.error("Error fetching report:", error);
    sendError(
      res,
      "Failed to fetch report",
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
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
        await fsp.unlink(req.file.path).catch(() => {});
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
          "OpenAI quota exceeded - saving report for later processing",
        );
      }
    }

    // If transcription succeeded, analyze it with Gemini
    let analysis = null;
    if (transcription) {
      try {
        analysis = await analyzeTranscription(transcription);
      } catch (analysisError) {
        logger.warn(
          "Gemini transcription analysis failed, using defaults:",
          analysisError.message,
        );
        analysis = {
          tag: "Other",
          confidence: 0,
          severity: 5,
          needs: ["Unknown"],
        };
      }
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
      await fsp.unlink(tempFilePath).catch((err) => {
        logger.warn("Failed to clean up temp file:", err.message);
      });
    } else if (!transcription) {
      logger.info("Keeping audio file for later processing");
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
    logger.error("Error processing audio report:", error);

    // Clean up temporary file on error (but not for quota errors)
    const isQuotaError =
      error.status === 429 || error.message?.includes("quota");

    if (tempFilePath && fs.existsSync(tempFilePath) && !isQuotaError) {
      await fsp.unlink(tempFilePath).catch((unlinkError) => {
        logger.error("Error deleting temporary file:", unlinkError);
      });
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
        coords = { lat: geoResult.lat, lng: geoResult.lng };
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
      HTTP_STATUS.CREATED,
    );
  } catch (error) {
    logger.error("Error creating report:", error);
    sendError(
      res,
      "Failed to create report",
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
}

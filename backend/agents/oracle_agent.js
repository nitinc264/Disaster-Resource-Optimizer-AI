// PROMPT FOR GITHUB COPILOT
// -------------------------
// Context:
// This is the "Oracle Agent" for Aegis AI. It watches MongoDB for reports that have been
// analyzed visually (by the Sentinel) and uses Google Gemini to assess severity.
//
// Technical Requirements:
// 1. Use 'mongoose' to connect to MongoDB.
// 2. Use '@google/generative-ai' for the Gemini 1.5 Flash API.
// 3. Import the Report model from './models/Report.js' (Assume schema exists).
//
// Workflow (setInterval Loop):
// 1. Every 3 seconds, find a report where:
//    - 'status' is 'Analyzed_Visual' OR 'Processing_Audio' (waiting for text analysis).
//    - 'oracleData' does NOT exist yet.
// 2. Construct a prompt for Gemini:
//    "The visual agent detected [sentinelData.tag] with [confidence] confidence.
//     The user text reported: [text].
//     Analyze this. Return ONLY JSON: { "severity": number (1-10), "needs": ["Water", "Rescue", etc], "summary": string }"
// 3. Call Gemini API.
// 4. Parse the JSON response.
// 5. Update the MongoDB document:
//    - Set 'oracleData' to the JSON result.
//    - Set 'status' to 'Analyzed_Full'.
// 6. Log activity to console: "[Oracle] Rated Severity: 9 for Report ID..."

// Start coding the imports and the loop below:
import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import Report from "../models/ReportModel.js";
import { analyzeReport } from "../services/geminiService.js";
import { dispatchEmergencyAlert } from "../services/emergencyAlertService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, "../.env") });

// Configuration
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/aegis_db";
const POLL_INTERVAL = 3000; // 3 seconds
const RUN_ONCE = (process.env.ORACLE_RUN_ONCE || "").toLowerCase() === "true";

console.log("[Oracle] Using shared Gemini Service for AI analysis...");

/**
 * Connect to MongoDB database
 */
async function connectDB() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log(`[Oracle] MongoDB Connected: ${mongoose.connection.host}`);
  } catch (error) {
    console.error(`[Oracle] MongoDB Connection Error: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Find and lock a report for processing
 */
async function findAndLockReport() {
  const statusFilter = {
    $or: [{ status: "Analyzed_Visual" }, { status: "Processing_Audio" }],
  };

  const oracleFilter = {
    $or: [
      { oracleData: { $exists: false } },
      { "oracleData.severity": { $exists: false } },
      { "oracleData.severity": null },
    ],
  };

  const report = await Report.findOneAndUpdate(
    {
      $and: [statusFilter, oracleFilter],
    },
    {
      $set: { status: "Processing_Oracle" },
    },
    {
      new: true,
    }
  );

  return report;
}

/**
 * Process a single report
 */
async function processReport(report) {
  console.log(`[Oracle] Processing Report ID: ${report._id}`);
  console.log(
    `[Oracle] Sentinel Data: ${report.sentinelData?.tag || "N/A"} (${(
      (report.sentinelData?.confidence || 0) * 100
    ).toFixed(1)}%)`
  );
  console.log(`[Oracle] User Text: ${report.text || "None"}`);

  try {
    // Analyze with shared Gemini service
    console.log(`[Oracle] Sending to Gemini for analysis...`);
    const analysisResult = await analyzeReport(report);

    // Update the document with Oracle results
    const updatedReport = await Report.findByIdAndUpdate(report._id, {
      $set: {
        oracleData: {
          severity: analysisResult.severity,
          needs: analysisResult.needs,
          summary: analysisResult.summary,
        },
        status: "Analyzed_Full",
      },
    }, { new: true });

    console.log(
      `[Oracle] Rated Severity: ${analysisResult.severity} for Report ID: ${report._id}`
    );
    console.log(`[Oracle] Needs: ${analysisResult.needs.join(", ")}`);
    console.log(`[Oracle] Summary: ${analysisResult.summary}`);
    console.log(`[Oracle] Report ${report._id} processed successfully!`);

    // Dispatch emergency alert to nearest station
    if (updatedReport && updatedReport.location?.lat && updatedReport.location?.lng) {
      const confidence = updatedReport.sentinelData?.confidence || 0;
      const severity = updatedReport.oracleData?.severity || 0;
      const tag = (updatedReport.sentinelData?.tag || "").toLowerCase();
      const text = (updatedReport.text || "").toLowerCase();

      const disasterTags = [
        "fire", "flood", "earthquake", "accident", "collapse", "rescue", "disaster",
      ];
      const textKeywords = [
        "fire", "flood", "earthquake", "accident", "collapse", "rescue",
        "burning", "trapped", "help", "emergency", "disaster", "injured",
        "drowning", "stampede", "explosion", "landslide", "storm",
      ];
      const isDisaster =
        confidence >= 0.5 ||
        severity >= 3 ||
        disasterTags.some((dt) => tag.includes(dt)) ||
        textKeywords.some((kw) => text.includes(kw));

      if (isDisaster) {
        console.log(`[Oracle] 🚨 Dispatching emergency alert for report ${report._id}`);
        try {
          const alertResult = await dispatchEmergencyAlert(updatedReport, "Report");
          if (alertResult.success) {
            console.log(
              `[Oracle] ✅ Alert dispatched: ${alertResult.alertId} to ${alertResult.stationsNotified} station(s)`
            );
          } else {
            console.warn(`[Oracle] ⚠️ Alert dispatch failed: ${alertResult.error}`);
          }
        } catch (alertError) {
          console.error(`[Oracle] ❌ Error dispatching emergency alert:`, alertError.message);
        }
      } else {
        console.log(
          `[Oracle] ℹ️ Report ${report._id} not classified as emergency (confidence: ${confidence}, severity: ${severity})`
        );
      }
    }

    console.log("-".repeat(50));
  } catch (error) {
    console.error(
      `[Oracle] Error processing report ${report._id}: ${error.message}`
    );

    // Revert status so the report can be retried after resolving the issue
    await Report.findByIdAndUpdate(report._id, {
      $set: {
        status: "Analyzed_Visual",
        errorMessage: `Oracle processing failed: ${error.message}`,
      },
    });
  }
}

/**
 * Main polling loop
 */
async function pollForReports() {
  try {
    const report = await findAndLockReport();

    if (report) {
      await processReport(report);
    } else {
      console.log("[Oracle] No reports pending Oracle analysis right now.");
    }
  } catch (error) {
    console.error(
      `[Oracle] Unexpected error in polling loop: ${error.message}`
    );
  }
}

/**
 * Start the Oracle Agent
 */
async function startOracle() {
  console.log("[Oracle] Starting Oracle Agent...");
  console.log(`[Oracle] Poll Interval: ${POLL_INTERVAL / 1000} seconds`);

  // Connect to database
  await connectDB();

  console.log("[Oracle] Watching for analyzed reports...");
  console.log("-".repeat(50));

  if (!RUN_ONCE) {
    // Start recurring polling
    setInterval(pollForReports, POLL_INTERVAL);
  }

  // Always run one immediate poll
  await pollForReports();

  if (RUN_ONCE) {
    console.log("[Oracle] Run-once mode complete. Shutting down...");
    await mongoose.connection.close();
    console.log("[Oracle] Disconnected from MongoDB. Goodbye!");
    process.exit(0);
  }
}

// Handle graceful shutdown
process.on("SIGINT", async () => {
  console.log("\n[Oracle] Shutting down gracefully...");
  await mongoose.connection.close();
  console.log("[Oracle] Disconnected from MongoDB. Goodbye!");
  process.exit(0);
});

// Start the agent
startOracle().catch((error) => {
  console.error(`[Oracle] Failed to start: ${error.message}`);
  process.exit(1);
});

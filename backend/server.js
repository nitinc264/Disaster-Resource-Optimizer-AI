/**
 * Disaster Response Resource Optimization Platform - Server Entry Point
 *
 * This file initializes and starts the Express server with all middleware,
 * routes, and error handlers configured.
 */

// Load environment variables FIRST before any other imports
import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import session from "express-session";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { spawn } from "child_process";
import multer from "multer";
import connectDB from "./config/db.js";
import config from "./config/index.js";
import apiRouter from "./routes/index.js";
import Report from "./models/ReportModel.js";
import { uploadImageBuffer } from "./services/cloudinaryService.js";
import {
  errorHandler,
  notFoundHandler,
  requestLogger,
} from "./middleware/index.js";
import { initializeDefaultManager } from "./controllers/authController.js";
import {
  dispatchEmergencyAlert,
  dispatchAlertToStation,
} from "./services/emergencyAlertService.js";
import Need from "./models/NeedModel.js";

// ES Module directory resolution
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// =============================================================================
// AGENT PROCESS MANAGEMENT
// =============================================================================

const agentProcesses = [];

/**
 * Start all background agents (Python and Node.js)
 */
function startAgents() {
  const agentsDir = path.join(__dirname, "agents");
  const projectRoot = path.join(__dirname, "..");

  // Determine Python executable path (use venv if available, fallback to system python)
  const isWindows = process.platform === "win32";

  // Check for venv in multiple locations: project root (.venv), agents folder (venv)
  const venvPaths = [
    isWindows
      ? path.join(projectRoot, ".venv", "Scripts", "python.exe")
      : path.join(projectRoot, ".venv", "bin", "python"),
    isWindows
      ? path.join(agentsDir, "venv", "Scripts", "python.exe")
      : path.join(agentsDir, "venv", "bin", "python"),
  ];

  // Check if venv exists, otherwise use system python
  let pythonCmd = isWindows ? "python" : "python3";
  for (const venvPython of venvPaths) {
    if (fs.existsSync(venvPython)) {
      pythonCmd = venvPython;
      console.log(`📦 Using Python venv: ${venvPython}`);
      break;
    }
  }

  if (pythonCmd === "python" || pythonCmd === "python3") {
    console.log(`📦 Using system Python: ${pythonCmd}`);
  }

  // Agent configurations
  const agents = [
    {
      name: "Oracle Agent",
      command: "node",
      args: [path.join(agentsDir, "oracle_agent.js")],
      emoji: "🔮",
    },
    {
      name: "Sentinel Agent",
      command: pythonCmd,
      args: [path.join(agentsDir, "sentinel_agent.py")],
      emoji: "👁️",
    },
    {
      name: "Logistics Agent",
      command: pythonCmd,
      args: [path.join(agentsDir, "logistics_agent.py")],
      emoji: "🚚",
    },
  ];

  console.log(
    "\n=============================================================================",
  );
  console.log("STARTING BACKGROUND AGENTS");
  console.log(
    "=============================================================================\n",
  );

  agents.forEach((agent) => {
    try {
      const proc = spawn(agent.command, agent.args, {
        cwd: agentsDir,
        stdio: ["ignore", "pipe", "pipe"],
        env: {
          ...process.env,
          PYTHONIOENCODING: "utf-8",
          PYTHONUNBUFFERED: "1",
          TF_CPP_MIN_LOG_LEVEL: "2", // Suppress TensorFlow info/warning logs
          TF_ENABLE_ONEDNN_OPTS: "0", // Disable oneDNN warnings
          PROTOCOL_BUFFERS_PYTHON_IMPLEMENTATION: "python", // Suppress protobuf warnings
        },
        detached: false,
      });

      agentProcesses.push({ name: agent.name, process: proc });

      console.log(`${agent.emoji} ${agent.name} started (PID: ${proc.pid})`);

      // Pipe agent stdout
      proc.stdout.on("data", (data) => {
        const lines = data.toString().trim().split("\n");
        lines.forEach((line) => {
          if (line) console.log(`${agent.emoji} ${line}`);
        });
      });

      // Pipe agent stderr
      proc.stderr.on("data", (data) => {
        const lines = data.toString().trim().split("\n");
        lines.forEach((line) => {
          if (line) console.error(`${agent.emoji} [ERROR] ${line}`);
        });
      });

      // Handle agent exit
      proc.on("close", (code) => {
        console.log(`${agent.emoji} ${agent.name} exited with code ${code}`);
      });

      proc.on("error", (err) => {
        console.error(
          `${agent.emoji} ${agent.name} failed to start:`,
          err.message,
        );
      });
    } catch (error) {
      console.error(`❌ Failed to start ${agent.name}:`, error.message);
    }
  });

  console.log(
    "\n=============================================================================\n",
  );
}

/**
 * Gracefully shutdown all agent processes
 */
function shutdownAgents() {
  console.log("\n🛑 Shutting down agents...");
  agentProcesses.forEach(({ name, process: proc }) => {
    if (proc && !proc.killed) {
      console.log(`   Stopping ${name} (PID: ${proc.pid})`);
      proc.kill("SIGTERM");
    }
  });
}

// Handle process termination
process.on("SIGINT", () => {
  shutdownAgents();
  process.exit(0);
});

process.on("SIGTERM", () => {
  shutdownAgents();
  process.exit(0);
});

// Connect to database and initialize default manager
connectDB().then(() => {
  initializeDefaultManager();
});

// Initialize Express app
const app = express();

// =============================================================================
// MIDDLEWARE
// =============================================================================

// CORS middleware
app.use(
  cors({
    ...config.cors,
    credentials: true, // Allow cookies to be sent with requests
  }),
);

// Session middleware - 24 hour persistence
app.use(
  session({
    secret: process.env.SESSION_SECRET || "disaster-response-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // Set to true in production with HTTPS
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      httpOnly: true,
      sameSite: "lax",
    },
  }),
);

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware (only in development)
if (config.logging?.requests) {
  app.use(requestLogger);
}

// =============================================================================
// MULTER CONFIGURATION (for image uploads)
// =============================================================================

const allowedImageTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
];

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max per photo
  },
  fileFilter: (req, file, cb) => {
    if (allowedImageTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Unsupported image format"));
    }
  },
});

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

const sanitizeSource = (source) => {
  const allowedSources = ["PWA", "SMS", "WhatsApp", "Audio"];
  if (!source) return "PWA";
  return allowedSources.includes(source) ? source : "PWA";
};

// =============================================================================
// ROUTES
// =============================================================================

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Disaster Response Resource Optimization Platform API",
    version: "1.0.0",
    environment: config.nodeEnv,
  });
});

// Mount main API routes (tasks, needs, optimization, SMS, etc.)
app.use("/api", apiRouter);

// -----------------------------------------------------------------------------
// Report Routes (Photo upload with Cloudinary)
// -----------------------------------------------------------------------------

// POST /api/reports/photo - Upload photo report with Cloudinary
app.post(
  "/api/reports/photo",
  imageUpload.single("image"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          error: "No image uploaded",
          message: "Attach an image file before submitting",
        });
      }

      const { lat, lng, message, source } = req.body;
      if (lat === undefined || lng === undefined) {
        return res.status(400).json({
          error: "Missing location data",
          message: "Latitude (lat) and longitude (lng) are required",
        });
      }

      let latNum = parseFloat(lat);
      let lngNum = parseFloat(lng);

      if (Number.isNaN(latNum) || Number.isNaN(lngNum)) {
        return res.status(400).json({
          error: "Invalid location",
          message: "Latitude and longitude must be valid numbers",
        });
      }

      // Default to Pune city center if coordinates are 0,0 (invalid/unset)
      const DEFAULT_LAT = 18.5204;
      const DEFAULT_LNG = 73.8567;
      let usedDefaultLocation = false;

      if (latNum === 0 && lngNum === 0) {
        console.log(
          "[WARN] Received 0,0 coordinates, using Pune default location",
        );
        latNum = DEFAULT_LAT;
        lngNum = DEFAULT_LNG;
        usedDefaultLocation = true;
      }

      let uploadResult;
      try {
        console.log("Attempting Cloudinary upload...");
        console.log("Cloud name:", process.env.CLOUDINARY_CLOUD_NAME);
        uploadResult = await uploadImageBuffer(req.file.buffer, {
          folder:
            process.env.CLOUDINARY_FOLDER || "disaster-response/reports/photos",
        });
        console.log("Upload successful:", uploadResult.secure_url);
      } catch (uploadError) {
        console.error("Cloudinary upload failed:", uploadError);
        return res.status(502).json({
          error: "Image upload failed",
          message:
            uploadError.message || "Unable to upload image at the moment",
        });
      }

      const report = new Report({
        source: sanitizeSource(source),
        text: message || null,
        imageUrl: uploadResult.secure_url,
        location: {
          lat: latNum,
          lng: lngNum,
          isApproximate: usedDefaultLocation,
        },
        status: "Pending",
        timestamp: new Date(),
      });

      const savedReport = await report.save();

      if (usedDefaultLocation) {
        console.log(
          `[INFO] Report ${savedReport._id} created with default location (Pune)`,
        );
      }

      return res.status(201).json({
        success: true,
        message: usedDefaultLocation
          ? "Photo report saved with approximate location (Pune city center)"
          : "Photo report saved successfully",
        data: {
          id: savedReport._id,
          imageUrl: savedReport.imageUrl,
          status: savedReport.status,
          location: savedReport.location,
          usedDefaultLocation,
        },
      });
    } catch (error) {
      console.error("Error creating photo report:", error);
      return res.status(500).json({
        error: "Failed to create photo report",
        message: error.message,
      });
    }
  },
);

// GET /api/reports/pending-visual - For Python Sentinel Agent
app.get("/api/reports/pending-visual", async (req, res) => {
  try {
    const reports = await Report.find({
      status: "Pending",
      imageUrl: { $ne: null },
    });
    res.json(reports);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// PATCH /api/reports/:id/update-agent - For Agents to update report data
app.patch("/api/reports/:id/update-agent", async (req, res) => {
  try {
    const { id } = req.params;
    const { sentinelData, oracleData, status } = req.body;

    const updateData = {};
    if (sentinelData) updateData.sentinelData = sentinelData;
    if (oracleData) updateData.oracleData = oracleData;
    if (status) updateData.status = status;

    const updatedReport = await Report.findByIdAndUpdate(id, updateData, {
      new: true,
    });

    if (!updatedReport) {
      return res.status(404).json({ message: "Report not found" });
    }

    // Dispatch emergency alert when report is fully analyzed
    const analyzedStatuses = ["Analyzed", "Analyzed_Full"];
    if (status && analyzedStatuses.includes(status)) {
      try {
        console.log(
          `📢 Report ${id} analyzed, checking for emergency dispatch...`,
        );

        // Only dispatch if we have location and a valid disaster detection
        if (updatedReport.location?.lat && updatedReport.location?.lng) {
          // Check if it's a valid disaster (high confidence or high severity)
          const confidence = updatedReport.sentinelData?.confidence || 0;
          const severity = updatedReport.oracleData?.severity || 0;
          const tag = (updatedReport.sentinelData?.tag || "").toLowerCase();
          const text = (updatedReport.text || "").toLowerCase();

          // Dispatch if: confidence OR severity OR disaster tags OR text keywords
          const disasterTags = [
            "fire",
            "flood",
            "earthquake",
            "accident",
            "collapse",
            "rescue",
            "disaster",
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
            console.log(`🚨 Dispatching emergency alert for report ${id}`);
            const alertResult = await dispatchEmergencyAlert(
              updatedReport,
              "Report",
            );

            if (alertResult.success) {
              console.log(
                `✅ Alert dispatched: ${alertResult.alertId} to ${alertResult.stationsNotified} stations`,
              );
            } else {
              console.warn(`⚠️ Alert dispatch failed: ${alertResult.error}`);
            }
          } else {
            console.log(
              `ℹ️ Report ${id} not classified as emergency (confidence: ${confidence}, severity: ${severity})`,
            );
          }
        }
      } catch (alertError) {
        console.error("Error dispatching emergency alert:", alertError);
        // Don't fail the update if alert dispatch fails
      }
    }

    res.json(updatedReport);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// PATCH /api/reports/:id/reroute - Reroute a rejected report/need to a specific station
app.patch("/api/reports/:id/reroute", async (req, res) => {
  try {
    const { id } = req.params;
    const { station } = req.body;

    if (!station || !station.type || !station.name) {
      return res.status(400).json({
        error: "Missing station data",
        message: "Station type and name are required",
      });
    }

    // Try to find as a Report first (by ObjectId or UUID reportId), then as a Need
    let sourceData = null;
    let sourceType = "Report";

    // Try MongoDB ObjectId lookup first
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      sourceData = await Report.findById(id);
    }
    // Try UUID reportId lookup
    if (!sourceData) {
      sourceData = await Report.findOne({ reportId: id });
    }
    // Try as a Need by ObjectId
    if (!sourceData) {
      if (id.match(/^[0-9a-fA-F]{24}$/)) {
        sourceData = await Need.findById(id);
      }
      if (sourceData) sourceType = "Need";
    }

    if (!sourceData) {
      return res.status(404).json({ error: "Report or need not found" });
    }

    // Dispatch alert to the selected station
    const alertResult = await dispatchAlertToStation(
      sourceData,
      sourceType,
      station,
    );

    if (alertResult.success) {
      console.log(
        `\u2705 Rerouted ${sourceType.toLowerCase()} ${id} to ${station.name}`,
      );
      return res.json({
        success: true,
        message: `Rerouted to ${station.name}`,
        alertId: alertResult.alertId,
        stationName: alertResult.stationName,
        stationType: alertResult.stationType,
      });
    } else {
      return res.status(500).json({
        error: "Reroute failed",
        message: alertResult.error || "Failed to dispatch alert to station",
      });
    }
  } catch (error) {
    console.error("Error rerouting report/need:", error);
    return res.status(500).json({
      error: "Failed to reroute",
      message: error.message,
    });
  }
});

// =============================================================================
// STATIC FILES & SPA ROUTING (Production)
// =============================================================================

if (config.nodeEnv === "production") {
  const frontendPath = path.join(__dirname, "../frontend/dist");
  app.use(express.static(frontendPath));

  // Handle SPA routing - send index.html for any non-API route
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) {
      return next();
    }
    res.sendFile(path.join(frontendPath, "index.html"));
  });
} else {
  // Development root handler
  app.get("/", (req, res) => {
    res.json({
      success: true,
      message: "Disaster Response Resource Optimization Platform API",
      version: "1.0.0",
      environment: config.nodeEnv,
    });
  });
}

// =============================================================================
// ERROR HANDLERS
// =============================================================================

// Multer error handler
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        error: "File too large",
        message: "Images must be 10MB or smaller",
      });
    }
    return res.status(400).json({
      error: "Upload failed",
      message: err.message,
    });
  }

  if (err?.message === "Unsupported image format") {
    return res.status(400).json({
      error: "Unsupported image format",
      message: "Please upload a JPG, PNG, WEBP, or HEIC photo",
    });
  }

  return next(err);
});

// 404 handler - must be after all routes
app.use(notFoundHandler);

// Global error handler - must be last
app.use(errorHandler);

// =============================================================================
// START SERVER
// =============================================================================

const PORT = config.port || process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Environment: ${config.nodeEnv}`);

  // Start all background agents after server is ready
  startAgents();
});

export default app;

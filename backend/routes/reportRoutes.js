import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import {
  processAudioReport,
  createReport,
  getAllReports,
  getReportById,
} from "../controllers/voiceReportController.js";

const router = express.Router();

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log(`Created uploads directory: ${uploadsDir}`);
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename: timestamp-originalname
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `audio-${uniqueSuffix}${ext}`);
  },
});

// File filter to accept audio and image files
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    "audio/webm",
    "audio/mpeg",
    "audio/mp4",
    "audio/wav",
    "audio/ogg",
    "audio/m4a",
  ];

  const allowedExtensions = [".webm", ".mp3", ".m4a", ".wav", ".ogg"];

  const ext = path.extname(file.originalname).toLowerCase();
  const mimeType = file.mimetype;

  if (allowedMimeTypes.includes(mimeType) || allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        `Invalid file type. Allowed types: ${allowedExtensions.join(", ")}`
      ),
      false
    );
  }
};

// Multer middleware configuration
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB limit (Whisper API limit)
  },
});

/**
 * POST /api/reports/audio
 * Upload and process audio report
 *
 * Request:
 * - Content-Type: multipart/form-data
 * - Body:
 *   - audio: File (required) - Audio file (.webm, .mp3, .m4a, .wav)
 *   - lat: Number (required) - Latitude
 *   - lng: Number (required) - Longitude
 *
 * Response:
 * - 201: Audio processed successfully
 * - 400: Invalid request (missing file or location)
 * - 500: Server error
 */
router.post("/audio", upload.single("audio"), processAudioReport);

/**
 * POST /api/reports
 * Create a new text-based report
 */
router.post("/", createReport);

/**
 * GET /api/reports
 * Get all reports (with optional status filter)
 */
router.get("/", getAllReports);

/**
 * GET /api/reports/:id
 * Get a specific report by ID
 */
router.get("/:id", getReportById);

// Error handling middleware for multer
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        error: "File too large",
        message: "Audio file must be smaller than 25MB",
      });
    }
    return res.status(400).json({
      error: "File upload error",
      message: error.message,
    });
  }

  if (error) {
    return res.status(400).json({
      error: "Upload failed",
      message: error.message,
    });
  }

  next();
});

export default router;

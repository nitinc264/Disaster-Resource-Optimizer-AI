/**
 * Missing Persons Routes
 * API endpoints for family reunification module
 */

import express from "express";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import MissingPerson from "../models/MissingPersonModel.js";
import { sendSuccess, sendError } from "../utils/apiResponse.js";
import { HTTP_STATUS } from "../constants/index.js";
import { requireAuth, requireManager } from "../middleware/authMiddleware.js";
import { uploadImageBuffer } from "../services/cloudinaryService.js";

const router = express.Router();

// Configure multer for photo uploads
const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/heic",
      "image/heif",
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Unsupported image format"));
    }
  },
});

/**
 * GET /api/missing-persons
 * Get all missing persons
 */
router.get("/missing-persons", requireAuth, async (req, res) => {
  try {
    const { status = "missing", priority, limit = 50 } = req.query;

    const query = {};
    if (status !== "all") {
      query.status = status;
    }
    if (priority) {
      query.priority = priority;
    }

    const persons = await MissingPerson.find(query)
      .sort({ priority: -1, reportedAt: -1 })
      .limit(parseInt(limit));

    sendSuccess(res, persons);
  } catch (error) {
    console.error("Error fetching missing persons:", error);
    sendError(
      res,
      "Failed to fetch missing persons",
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
});

/**
 * GET /api/missing-persons/:id
 * Get a specific missing person case
 */
router.get("/missing-persons/:id", requireAuth, async (req, res) => {
  try {
    const person = await MissingPerson.findOne({ caseId: req.params.id });

    if (!person) {
      return sendError(res, "Case not found", HTTP_STATUS.NOT_FOUND);
    }

    sendSuccess(res, person);
  } catch (error) {
    console.error("Error fetching missing person:", error);
    sendError(res, "Failed to fetch case", HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
});

/**
 * POST /api/missing-persons
 * Report a missing person (supports photo upload)
 */
router.post(
  "/missing-persons",
  requireAuth,
  photoUpload.single("photo"),
  async (req, res) => {
    try {
      // Parse JSON data from form field if sent as FormData
      let data = req.body;
      if (req.body.data) {
        try {
          data = JSON.parse(req.body.data);
        } catch {
          data = req.body;
        }
      }

      const {
        fullName,
        nickname,
        age,
        gender,
        description,
        lastSeenLocation,
        lastSeenDate,
        reporterInfo,
        priority,
      } = data;

      if (!fullName || !reporterInfo?.name || !reporterInfo?.phone) {
        return sendError(
          res,
          "Full name and reporter contact are required",
          HTTP_STATUS.BAD_REQUEST
        );
      }

      // Upload photo to Cloudinary if provided
      let photos = [];
      if (req.file) {
        try {
          const uploadResult = await uploadImageBuffer(req.file.buffer, {
            folder: "disaster-response/missing-persons",
            transformation: [
              { width: 800, height: 800, crop: "limit" },
              { quality: "auto:good" },
            ],
          });
          photos = [
            {
              url: uploadResult.secure_url,
              publicId: uploadResult.public_id,
              isPrimary: true,
              uploadedAt: new Date(),
            },
          ];
        } catch (uploadError) {
          console.error("Photo upload failed:", uploadError);
          // Continue without photo if upload fails
        }
      }

      // Determine priority based on vulnerability
      let calculatedPriority = priority || "medium";
      const parsedAge = parseInt(age);
      if (parsedAge && parsedAge < 12) calculatedPriority = "critical";
      else if (parsedAge && parsedAge > 70) calculatedPriority = "high";

      const person = new MissingPerson({
        caseId: `MP-${uuidv4().slice(0, 8).toUpperCase()}`,
        fullName,
        nickname,
        age: parsedAge || undefined,
        gender,
        description:
          typeof description === "string"
            ? { physical: description }
            : description || {},
        photos,
        lastSeenLocation: lastSeenLocation || {},
        lastSeenDate: lastSeenDate ? new Date(lastSeenDate) : new Date(),
        reporterInfo,
        priority: calculatedPriority,
        isChild: parsedAge && parsedAge < 18,
        isElderly: parsedAge && parsedAge > 65,
        hasMedicalNeeds: data.medicalInfo ? true : false,
      });

      await person.save();
      sendSuccess(res, person, "Missing person report submitted successfully");
    } catch (error) {
      console.error("Error reporting missing person:", error);
      sendError(
        res,
        "Failed to submit report",
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      );
    }
  }
);

/**
 * PATCH /api/missing-persons/:id/found
 * Mark a missing person as found
 */
router.patch("/missing-persons/:id/found", requireAuth, async (req, res) => {
  try {
    const { foundLocation, foundBy, currentShelter, condition, notes } =
      req.body;

    const person = await MissingPerson.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          status: "found",
          foundInfo: {
            foundDate: new Date(),
            foundLocation,
            foundBy,
            currentShelter,
            condition,
            notes,
          },
          updatedAt: new Date(),
        },
      },
      { new: true }
    );

    if (!person) {
      return sendError(res, "Case not found", HTTP_STATUS.NOT_FOUND);
    }

    sendSuccess(res, person, "Person marked as found");
  } catch (error) {
    console.error("Error updating missing person:", error);
    sendError(res, "Failed to update case", HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
});

/**
 * PATCH /api/missing-persons/:id/reunited
 * Mark a missing person as reunited with family
 */
router.patch("/missing-persons/:id/reunited", requireAuth, async (req, res) => {
  try {
    const person = await MissingPerson.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          status: "reunited",
          resolvedAt: new Date(),
          updatedAt: new Date(),
        },
      },
      { new: true }
    );

    if (!person) {
      return sendError(res, "Case not found", HTTP_STATUS.NOT_FOUND);
    }

    sendSuccess(res, person, "Family reunited successfully");
  } catch (error) {
    console.error("Error updating missing person:", error);
    sendError(res, "Failed to update case", HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
});

/**
 * POST /api/missing-persons/:id/match
 * Add a potential match to a missing person case
 */
router.post("/missing-persons/:id/match", requireAuth, async (req, res) => {
  try {
    const { matchedPersonId, matchConfidence, matchType } = req.body;

    const person = await MissingPerson.findByIdAndUpdate(
      req.params.id,
      {
        $push: {
          potentialMatches: {
            matchedPersonId,
            matchConfidence,
            matchType,
            matchedAt: new Date(),
          },
        },
        $set: { updatedAt: new Date() },
      },
      { new: true }
    );

    if (!person) {
      return sendError(res, "Case not found", HTTP_STATUS.NOT_FOUND);
    }

    sendSuccess(res, person, "Match added successfully");
  } catch (error) {
    console.error("Error adding match:", error);
    sendError(res, "Failed to add match", HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
});

/**
 * GET /api/missing-persons/search
 * Search for missing persons by name or description
 */
router.get("/missing-persons/search", requireAuth, async (req, res) => {
  try {
    const { q, lat, lon, radius = 5 } = req.query;

    let query = { status: "missing" };

    if (q) {
      query.$text = { $search: q };
    }

    const persons = await MissingPerson.find(query)
      .sort({ priority: -1, reportedAt: -1 })
      .limit(20);

    sendSuccess(res, persons);
  } catch (error) {
    console.error("Error searching missing persons:", error);
    sendError(res, "Failed to search", HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
});

/**
 * GET /api/missing-persons/stats
 * Get statistics about missing persons
 */
router.get("/missing-persons/stats", requireAuth, async (req, res) => {
  try {
    const stats = await MissingPerson.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    const priorityStats = await MissingPerson.aggregate([
      { $match: { status: "missing" } },
      {
        $group: {
          _id: "$priority",
          count: { $sum: 1 },
        },
      },
    ]);

    sendSuccess(res, {
      byStatus: stats.reduce((acc, s) => ({ ...acc, [s._id]: s.count }), {}),
      byPriority: priorityStats.reduce(
        (acc, s) => ({ ...acc, [s._id]: s.count }),
        {}
      ),
      total: stats.reduce((sum, s) => sum + s.count, 0),
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    sendError(
      res,
      "Failed to fetch statistics",
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
});

export default router;

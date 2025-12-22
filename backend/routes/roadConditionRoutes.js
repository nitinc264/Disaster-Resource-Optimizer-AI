/**
 * Road Conditions Routes
 * API endpoints for crowd-sourced road condition reporting
 */

import express from "express";
import { v4 as uuidv4 } from "uuid";
import RoadCondition from "../models/RoadConditionModel.js";
import { sendSuccess, sendError } from "../utils/apiResponse.js";
import { HTTP_STATUS } from "../constants/index.js";
import { requireAuth, requireManager } from "../middleware/authMiddleware.js";
import { body, validationResult } from "express-validator";

const router = express.Router();

/**
 * GET /api/roads
 * Get all active road conditions
 */
router.get("/roads", requireAuth, async (req, res) => {
  try {
    const { status = "active", type } = req.query;

    const query = {};
    if (status !== "all") {
      query.status = status;
    }
    if (type) {
      query.conditionType = type;
    }

    const conditions = await RoadCondition.find(query)
      .sort({ reportedAt: -1 })
      .limit(100);

    sendSuccess(res, conditions);
  } catch (error) {
    console.error("Error fetching road conditions:", error);
    sendError(
      res,
      "Failed to fetch road conditions",
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
});

/**
 * GET /api/roads/:id
 * Get a specific road condition
 */
router.get("/roads/:id", requireAuth, async (req, res) => {
  try {
    const condition = await RoadCondition.findOne({
      conditionId: req.params.id,
    });

    if (!condition) {
      return sendError(res, "Road condition not found", HTTP_STATUS.NOT_FOUND);
    }

    sendSuccess(res, condition);
  } catch (error) {
    console.error("Error fetching road condition:", error);
    sendError(
      res,
      "Failed to fetch road condition",
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
});

/**
 * POST /api/roads
 * Report a new road condition
 */
router.post(
  "/roads",
  requireAuth,
  body("startPoint.lat").isFloat().withMessage("startPoint.lat is required"),
  body("startPoint.lng").isFloat().withMessage("startPoint.lng is required"),
  body("description").isLength({ min: 1 }).withMessage("Description is required"),
  body("conditionType").isLength({ min: 1 }).withMessage("Condition type is required"),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendError(res, errors.array()[0].msg, HTTP_STATUS.BAD_REQUEST);
    }

    try {
      const {
        startPoint,
        endPoint,
        roadName,
        description,
        conditionType,
        severity,
        reportedBy,
        reporterType,
        photos,
        estimatedClearTime,
      } = req.body;

      const condition = new RoadCondition({
        conditionId: `ROAD-${uuidv4().slice(0, 8).toUpperCase()}`,
        startPoint,
        endPoint: endPoint || startPoint,
        roadName,
        description,
        conditionType,
        severity: severity || "medium",
        reportedBy: reportedBy || "anonymous",
        reporterType: reporterType || "public",
        photos: photos || [],
        estimatedClearTime: estimatedClearTime
          ? new Date(estimatedClearTime)
          : null,
      });

      await condition.save();
      sendSuccess(res, condition, "Road condition reported successfully");
    } catch (error) {
      console.error("Error reporting road condition:", error.message, error);
      sendError(
        res,
        error?.message || "Failed to report road condition",
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      );
    }
  }
);

/**
 * PATCH /api/roads/:id/verify
 * Verify a road condition report
 */
router.patch("/roads/:id/verify", requireAuth, async (req, res) => {
  try {
    const { verifiedBy } = req.body;

    const condition = await RoadCondition.findOneAndUpdate(
      { conditionId: req.params.id },
      {
        $inc: { verificationCount: 1 },
        $set: {
          verified: true,
          verifiedBy,
          verifiedAt: new Date(),
          updatedAt: new Date(),
        },
      },
      { new: true }
    );

    if (!condition) {
      return sendError(res, "Road condition not found", HTTP_STATUS.NOT_FOUND);
    }

    sendSuccess(res, condition, "Road condition verified");
  } catch (error) {
    console.error("Error verifying road condition:", error);
    sendError(
      res,
      "Failed to verify road condition",
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
});

/**
 * PATCH /api/roads/:id/status
 * Update road condition status
 */
router.patch("/roads/:id/status", requireManager, async (req, res) => {
  try {
    const { status } = req.body;

    if (!["active", "cleared", "partial"].includes(status)) {
      return sendError(res, "Invalid status", HTTP_STATUS.BAD_REQUEST);
    }

    const updateData = {
      status,
      updatedAt: new Date(),
    };

    if (status === "cleared") {
      updateData.clearedAt = new Date();
    }

    const condition = await RoadCondition.findOneAndUpdate(
      { conditionId: req.params.id },
      { $set: updateData },
      { new: true }
    );

    if (!condition) {
      return sendError(res, "Road condition not found", HTTP_STATUS.NOT_FOUND);
    }

    sendSuccess(res, condition, "Road condition status updated");
  } catch (error) {
    console.error("Error updating road condition:", error);
    sendError(
      res,
      "Failed to update road condition",
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
});

/**
 * DELETE /api/roads/:id
 * Delete a road condition report
 */
router.delete("/roads/:id", requireManager, async (req, res) => {
  try {
    const condition = await RoadCondition.findOneAndDelete({
      conditionId: req.params.id,
    });

    if (!condition) {
      return sendError(res, "Road condition not found", HTTP_STATUS.NOT_FOUND);
    }

    sendSuccess(res, null, "Road condition deleted");
  } catch (error) {
    console.error("Error deleting road condition:", error);
    sendError(
      res,
      "Failed to delete road condition",
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
});

export default router;

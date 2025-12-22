import Need from "../models/NeedModel.js";
import { asyncHandler, ApiError } from "../middleware/index.js";
import { sendSuccess } from "../utils/apiResponse.js";
import { logger } from "../utils/appLogger.js";
import { STATUS } from "../constants/index.js";
import { dispatchEmergencyAlert } from "../services/emergencyAlertService.js";

const MAX_UNVERIFIED = 50;
const MAX_VERIFIED = 100;
const MAX_MAP_NEEDS = 200;

/**
 * Helper function to describe a need
 */
const describeNeed = (need) =>
  need.triageData?.details || need.rawMessage || "No description";

/**
 * Convert Need model to Task DTO
 */
const toTaskDto = (need) => ({
  id: need._id.toString(),
  taskId: need._id.toString(),
  description: describeNeed(need),
  notes: need.triageData?.location || "",
  location: need.triageData?.location,
  needType: need.triageData?.needType,
  urgency: need.triageData?.urgency,
  phoneNumber: need.fromNumber,
  status: need.status,
  createdAt: need.createdAt,
  lat: need.coordinates?.lat,
  lon: need.coordinates?.lon,
});

/**
 * Convert Need model to Map DTO
 */
const toMapNeedDto = (need) => ({
  id: need._id.toString(),
  lat: need.coordinates?.lat,
  lon: need.coordinates?.lon,
  status: need.status,
  emergencyStatus: need.emergencyStatus || "none",
  emergencyType: need.emergencyType || "general",
  emergencyAlertId: need.emergencyAlertId,
  assignedStation: need.assignedStation,
  description: describeNeed(need),
  needType: need.triageData?.needType,
  urgency: need.triageData?.urgency,
  location: need.triageData?.location || need.coordinates?.formattedAddress,
  verifiedAt: need.verifiedAt,
  createdAt: need.createdAt,
});

/**
 * GET /api/tasks/unverified
 * Get all unverified tasks
 */
export const getUnverifiedTasks = asyncHandler(async (req, res) => {
  const unverifiedNeeds = await Need.find({ status: STATUS.UNVERIFIED })
    .sort({ createdAt: -1 })
    .limit(MAX_UNVERIFIED);

  logger.debug(`Found ${unverifiedNeeds.length} unverified tasks`);

  sendSuccess(
    res,
    unverifiedNeeds.map(toTaskDto),
    "Unverified tasks retrieved successfully"
  );
});

/**
 * POST /api/tasks/verify
 * Verify a task
 */
export const verifyTask = asyncHandler(async (req, res) => {
  const { taskId, volunteerNotes } = req.body;

  if (!taskId) {
    throw new ApiError(400, "taskId is required");
  }

  const updatedNeed = await Need.findByIdAndUpdate(
    taskId,
    {
      status: STATUS.VERIFIED,
      verificationNotes: volunteerNotes || "",
      verifiedAt: new Date(),
    },
    { new: true }
  );

  if (!updatedNeed) {
    throw new ApiError(404, "Task not found");
  }

  logger.info(`Task ${taskId} verified successfully`);

  // Dispatch emergency alert to appropriate stations
  if (updatedNeed.coordinates?.lat && updatedNeed.coordinates?.lon) {
    try {
      logger.info(`Dispatching emergency alert for verified task ${taskId}`);
      const alertResult = await dispatchEmergencyAlert(updatedNeed, "Need");

      if (alertResult.success) {
        logger.info(`Emergency alert dispatched: ${alertResult.alertId}`, {
          stationsNotified: alertResult.stationsNotified,
          emergencyType: alertResult.emergencyType,
        });
      } else {
        logger.warn(`Failed to dispatch emergency alert: ${alertResult.error}`);
      }
    } catch (alertError) {
      // Don't fail the verification if alert dispatch fails
      logger.error("Error dispatching emergency alert:", alertError);
    }
  } else {
    logger.warn(
      `Task ${taskId} verified but has no coordinates for alert dispatch`
    );
  }

  sendSuccess(
    res,
    {
      id: updatedNeed._id,
      status: updatedNeed.status,
      verificationNotes: updatedNeed.verificationNotes,
      verifiedAt: updatedNeed.verifiedAt,
    },
    "Task verified successfully"
  );
});

/**
 * GET /api/tasks/verified
 * Get all verified tasks
 */
export const getVerifiedTasks = asyncHandler(async (req, res) => {
  const verifiedNeeds = await Need.find({ status: STATUS.VERIFIED })
    .sort({ verifiedAt: -1 })
    .limit(MAX_VERIFIED);

  logger.debug(`Found ${verifiedNeeds.length} verified tasks`);

  sendSuccess(
    res,
    verifiedNeeds.map(toTaskDto),
    "Verified tasks retrieved successfully"
  );
});

/**
 * GET /api/needs/map
 * Get all needs with coordinates for map display
 */
export const getNeedsForMap = asyncHandler(async (req, res) => {
  const needs = await Need.find({ "coordinates.lat": { $exists: true } })
    .sort({ createdAt: -1 })
    .limit(MAX_MAP_NEEDS);

  const mapReadyNeeds = needs
    .map(toMapNeedDto)
    .filter(
      (need) => typeof need.lat === "number" && typeof need.lon === "number"
    );

  logger.debug(`Found ${mapReadyNeeds.length} needs for map display`);

  sendSuccess(res, mapReadyNeeds, "Map needs retrieved successfully");
});

import Need from "../models/NeedModel.js";
import { asyncHandler, ApiError } from "../middleware/index.js";
import { sendSuccess } from "../utils/apiResponse.js";
import { logger } from "../utils/appLogger.js";
import { STATUS, GEOCODE_DEFAULTS } from "../constants/index.js";
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
 * Uses fallback coordinates if not available, with small offset to prevent overlapping
 */
const toMapNeedDto = (need, index = 0) => {
  // Check if need has valid coordinates
  const hasValidCoordinates =
    typeof need.coordinates?.lat === "number" &&
    typeof need.coordinates?.lon === "number";

  // For needs without coordinates, add a small offset based on index
  // This prevents multiple pins from overlapping at the exact same location
  // Creates a spiral pattern around the default location
  let lat, lon;
  if (hasValidCoordinates) {
    lat = need.coordinates.lat;
    lon = need.coordinates.lon;
  } else {
    // Create a small offset in a spiral pattern (max ~500m radius)
    const angle = index * 137.5 * (Math.PI / 180); // Golden angle for even distribution
    const radius = 0.002 + (index * 0.0008); // Start at ~200m, increase by ~80m per point
    lat = GEOCODE_DEFAULTS.DEFAULT_LAT + (radius * Math.cos(angle));
    lon = GEOCODE_DEFAULTS.DEFAULT_LON + (radius * Math.sin(angle));
  }

  return {
    id: need._id.toString(),
    lat,
    lon,
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
    hasExactLocation: hasValidCoordinates, // Flag for UI to show approximate location indicator
  };
};

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
  // Use fallback coordinates if not available
  try {
    const hasValidCoordinates =
      typeof updatedNeed.coordinates?.lat === "number" &&
      typeof updatedNeed.coordinates?.lon === "number";

    // Create a copy with fallback coordinates if needed
    const needForAlert = hasValidCoordinates
      ? updatedNeed
      : {
          ...updatedNeed.toObject(),
          coordinates: {
            lat: GEOCODE_DEFAULTS.DEFAULT_LAT,
            lon: GEOCODE_DEFAULTS.DEFAULT_LON,
            formattedAddress: updatedNeed.triageData?.location || "Pune, India (approximate)",
          },
        };

    if (!hasValidCoordinates) {
      logger.info(`Task ${taskId} has no coordinates, using fallback location for alert dispatch`);
    }

    logger.info(`Dispatching emergency alert for verified task ${taskId}`);
    const alertResult = await dispatchEmergencyAlert(needForAlert, "Need");

    if (alertResult.success) {
      logger.info(`Emergency alert dispatched: ${alertResult.alertId}`, {
        stationsNotified: alertResult.stationsNotified,
        emergencyType: alertResult.emergencyType,
        usedFallbackLocation: !hasValidCoordinates,
      });
    } else {
      logger.warn(`Failed to dispatch emergency alert: ${alertResult.error}`);
    }
  } catch (alertError) {
    // Don't fail the verification if alert dispatch fails
    logger.error("Error dispatching emergency alert:", alertError);
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
 * Get all needs for map display
 * Needs without coordinates will use fallback location with offset
 */
export const getNeedsForMap = asyncHandler(async (req, res) => {
  // Fetch ALL needs, not just those with coordinates
  // The toMapNeedDto function will assign fallback coordinates if needed
  const needs = await Need.find({})
    .sort({ createdAt: -1 })
    .limit(MAX_MAP_NEEDS);

  // Track index for needs without coordinates to create offset
  let noCoordIndex = 0;
  const mapReadyNeeds = needs.map((need) => {
    const hasCoords = typeof need.coordinates?.lat === "number" && typeof need.coordinates?.lon === "number";
    const dto = toMapNeedDto(need, hasCoords ? 0 : noCoordIndex);
    if (!hasCoords) noCoordIndex++;
    return dto;
  });

  logger.debug(`Found ${mapReadyNeeds.length} needs for map display (including ${mapReadyNeeds.filter(n => !n.hasExactLocation).length} with approximate location)`);

  sendSuccess(res, mapReadyNeeds, "Map needs retrieved successfully");
});

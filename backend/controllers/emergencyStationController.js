import EmergencyStation from "../models/EmergencyStationModel.js";
import EmergencyAlert from "../models/EmergencyAlertModel.js";
import {
  dispatchEmergencyAlert,
  processStationAcknowledgment,
  registerStation,
  updateStationStatus,
  pingStation,
} from "../services/emergencyAlertService.js";
import { logger } from "../utils/appLogger.js";

// Helper functions to match the utility signature
const sendSuccess = (res, data, message = "Success", statusCode = 200) => {
  res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

const sendError = (res, message, statusCode = 500, details = null) => {
  res.status(statusCode).json({
    success: false,
    message,
    ...(details && { details }),
  });
};

/**
 * Emergency Station Controller
 * Handles registration, management, and alerting of emergency stations
 */

/**
 * GET /api/emergency-stations
 * Get all registered emergency stations
 */
export async function getAllStations(req, res) {
  try {
    const { type, status } = req.query;

    const filter = {};
    if (type) filter.type = type;
    if (status) filter.status = status;

    const stations = await EmergencyStation.find(filter)
      .sort({ type: 1, name: 1 })
      .select("-apiConfig.apiKey"); // Don't expose API keys

    sendSuccess(res, { stations }, "Stations retrieved successfully", 200);
  } catch (error) {
    logger.error("Error getting stations:", error);
    sendError(res, "Failed to retrieve stations", 500);
  }
}

/**
 * GET /api/emergency-stations/:id
 * Get a specific emergency station
 */
export async function getStation(req, res) {
  try {
    const station = await EmergencyStation.findById(req.params.id).select(
      "-apiConfig.apiKey",
    );

    if (!station) {
      return sendError(res, "Station not found", 404);
    }

    sendSuccess(res, { station }, "Station retrieved successfully", 200);
  } catch (error) {
    logger.error("Error getting station:", error);
    sendError(res, "Failed to retrieve station", 500);
  }
}

/**
 * POST /api/emergency-stations
 * Register a new emergency station
 */
export async function createStation(req, res) {
  try {
    const {
      stationId,
      name,
      type,
      location,
      apiConfig,
      capabilities,
      contact,
      isOperational24x7,
    } = req.body;

    // Validate required fields
    if (!stationId || !name || !type || !location || !apiConfig) {
      return sendError(res, "Missing required fields", 400);
    }

    // Check if station with same stationId already exists
    const existingStation = await EmergencyStation.findOne({ stationId });
    if (existingStation) {
      return sendError(res, "Station with this ID already exists", 409);
    }

    const station = await registerStation({
      stationId,
      name,
      type,
      location,
      apiConfig,
      capabilities: capabilities || [type, "general"],
      contact,
      isOperational24x7,
    });

    // Return station without API key
    const stationResponse = station.toObject();
    delete stationResponse.apiConfig.apiKey;

    sendSuccess(
      res,
      { station: stationResponse },
      "Station registered successfully",
      201,
    );
  } catch (error) {
    logger.error("Error creating station:", error);
    sendError(res, "Failed to register station", 500);
  }
}

/**
 * PUT /api/emergency-stations/:id
 * Update an emergency station
 */
export async function updateStation(req, res) {
  try {
    const updates = req.body;

    // Don't allow updating certain fields directly
    delete updates._id;
    delete updates.stationId;
    delete updates.stats;

    const station = await EmergencyStation.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true },
    ).select("-apiConfig.apiKey");

    if (!station) {
      return sendError(res, "Station not found", 404);
    }

    sendSuccess(res, { station }, "Station updated successfully", 200);
  } catch (error) {
    logger.error("Error updating station:", error);
    sendError(res, "Failed to update station", 500);
  }
}

/**
 * DELETE /api/emergency-stations/:id
 * Delete an emergency station
 */
export async function deleteStation(req, res) {
  try {
    const station = await EmergencyStation.findByIdAndDelete(req.params.id);

    if (!station) {
      return sendError(res, "Station not found", 404);
    }

    sendSuccess(
      res,
      {
        stationId: station.stationId,
        name: station.name,
      },
      "Station deleted successfully",
      200,
    );
  } catch (error) {
    logger.error("Error deleting station:", error);
    sendError(res, "Failed to delete station", 500);
  }
}

/**
 * POST /api/emergency-stations/:id/ping
 * Ping a station to check if it's online
 */
export async function pingStationEndpoint(req, res) {
  try {
    const result = await pingStation(req.params.id);

    if (result.success) {
      sendSuccess(res, result, "Station is online", 200);
    } else {
      sendSuccess(res, result, "Station is offline", 200);
    }
  } catch (error) {
    logger.error("Error pinging station:", error);
    sendError(res, "Failed to ping station", 500);
  }
}

/**
 * POST /api/emergency-stations/:id/status
 * Update station status
 */
export async function updateStatusEndpoint(req, res) {
  try {
    const { status } = req.body;

    if (!["active", "inactive", "busy", "offline"].includes(status)) {
      return sendError(res, "Invalid status value", 400);
    }

    const station = await updateStationStatus(req.params.id, status);

    if (!station) {
      return sendError(res, "Station not found", 404);
    }

    sendSuccess(
      res,
      {
        stationId: station.stationId,
        name: station.name,
        status: station.status,
      },
      "Station status updated",
      200,
    );
  } catch (error) {
    logger.error("Error updating station status:", error);
    sendError(res, "Failed to update station status", 500);
  }
}

/**
 * GET /api/emergency-stations/nearest
 * Find nearest stations to a location
 */
export async function findNearestStations(req, res) {
  try {
    const { lat, lng, type, limit = 3 } = req.query;

    if (!lat || !lng) {
      return sendError(res, "Latitude and longitude are required", 400);
    }

    let stations;

    if (type) {
      stations = await EmergencyStation.findNearest(
        parseFloat(lat),
        parseFloat(lng),
        type,
        parseInt(limit),
      );
    } else {
      // Find nearest of all types
      const types = ["fire", "hospital", "police", "rescue", "ambulance"];
      stations = [];

      for (const t of types) {
        const nearest = await EmergencyStation.findNearest(
          parseFloat(lat),
          parseFloat(lng),
          t,
          1,
        );
        stations.push(...nearest);
      }

      // Sort by distance
      stations.sort((a, b) => a.distance - b.distance);
    }

    const response = stations.map(({ station, distance }) => ({
      id: station._id,
      stationId: station.stationId,
      name: station.name,
      type: station.type,
      location: station.location,
      status: station.status,
      distance: distance.toFixed(2) + " km",
      distanceValue: distance,
    }));

    sendSuccess(res, { stations: response }, "Nearest stations found", 200);
  } catch (error) {
    logger.error("Error finding nearest stations:", error);
    sendError(res, "Failed to find nearest stations", 500);
  }
}

// ============================================================================
// ALERT MANAGEMENT
// ============================================================================

/**
 * GET /api/emergency-alerts
 * Get all emergency alerts
 */
export async function getAllAlerts(req, res) {
  try {
    const { status, emergencyType, limit = 50 } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (emergencyType) filter.emergencyType = emergencyType;

    const alerts = await EmergencyAlert.find(filter)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .populate("sentToStations.stationId", "name type location");

    sendSuccess(res, { alerts }, "Alerts retrieved successfully", 200);
  } catch (error) {
    logger.error("Error getting alerts:", error);
    sendError(res, "Failed to retrieve alerts", 500);
  }
}

/**
 * GET /api/emergency-alerts/:alertId
 * Get a specific alert
 */
export async function getAlert(req, res) {
  try {
    const alert = await EmergencyAlert.findOne({
      alertId: req.params.alertId,
    }).populate("sentToStations.stationId", "name type location contact");

    if (!alert) {
      return sendError(res, "Alert not found", 404);
    }

    sendSuccess(res, { alert }, "Alert retrieved successfully", 200);
  } catch (error) {
    logger.error("Error getting alert:", error);
    sendError(res, "Failed to retrieve alert", 500);
  }
}

/**
 * POST /api/emergency-alerts/dispatch
 * Manually dispatch an emergency alert
 */
export async function dispatchAlert(req, res) {
  try {
    const { emergencyType, severity, location, title, description, needs } =
      req.body;

    if (!emergencyType || !location || !title) {
      return sendError(res, "Missing required fields", 400);
    }

    // Create a synthetic source data object
    const sourceData = {
      _id: null, // No source document
      text: description,
      location: {
        lat: location.lat,
        lng: location.lng,
      },
      oracleData: {
        severity: severity || 5,
        needs: needs || [],
      },
    };

    const result = await dispatchEmergencyAlert(sourceData, "Report");

    if (result.success) {
      sendSuccess(res, result, "Alert dispatched successfully", 200);
    } else {
      sendError(res, result.error || "Failed to dispatch alert", 500);
    }
  } catch (error) {
    logger.error("Error dispatching alert:", error);
    sendError(res, "Failed to dispatch alert", 500);
  }
}

/**
 * POST /api/emergency-alerts/:alertId/acknowledge
 * Acknowledge an alert (called by station)
 */
export async function acknowledgeAlert(req, res) {
  try {
    const { alertId } = req.params;
    const { stationId, apiKey, notes } = req.body;

    if (!stationId) {
      return sendError(res, "Station ID is required", 400);
    }

    if (!apiKey) {
      return sendError(res, "API key is required", 401);
    }

    // Verify API key against station
    let station = await EmergencyStation.findOne({ stationId });
    if (!station) {
      station = await EmergencyStation.findOne({
        name: { $regex: stationId, $options: "i" },
      });
    }
    if (
      station &&
      station.apiConfig?.apiKey &&
      station.apiConfig.apiKey !== apiKey
    ) {
      return sendError(res, "Invalid API key", 403);
    }

    const result = await processStationAcknowledgment(alertId, stationId, {
      notes,
    });

    if (result.success) {
      sendSuccess(res, result, "Alert acknowledged", 200);
    } else {
      sendError(res, result.error, 400);
    }
  } catch (error) {
    logger.error("Error acknowledging alert:", error);
    sendError(res, "Failed to acknowledge alert", 500);
  }
}

/**
 * PUT /api/emergency-alerts/:alertId/status
 * Update alert status
 */
export async function updateAlertStatus(req, res) {
  try {
    const { status } = req.body;

    const validStatuses = [
      "created",
      "dispatched",
      "acknowledged",
      "responding",
      "resolved",
      "cancelled",
    ];
    if (!validStatuses.includes(status)) {
      return sendError(res, "Invalid status value", 400);
    }

    const alert = await EmergencyAlert.findOneAndUpdate(
      { alertId: req.params.alertId },
      {
        status,
        ...(status === "resolved" && { resolvedAt: new Date() }),
      },
      { new: true },
    );

    if (!alert) {
      return sendError(res, "Alert not found", 404);
    }

    sendSuccess(
      res,
      {
        alertId: alert.alertId,
        status: alert.status,
      },
      "Alert status updated",
      200,
    );
  } catch (error) {
    logger.error("Error updating alert status:", error);
    sendError(res, "Failed to update alert status", 500);
  }
}

/**
 * POST /api/emergency-stations/callback/dispatched
 * Callback from station when units are dispatched
 * This is called by the station website when a unit is dispatched
 */
export async function stationDispatchCallback(req, res) {
  try {
    const {
      alertId,
      stationId,
      apiKey,
      dispatchedUnits,
      estimatedArrival,
      notes,
    } = req.body;

    logger.info(
      `Dispatch callback received: alertId=${alertId}, stationId=${stationId}`,
    );

    if (!alertId || !stationId) {
      return sendError(res, "Missing required fields: alertId, stationId", 400);
    }

    // Find station - try by stationId first, then by name for flexibility
    let station = await EmergencyStation.findOne({ stationId });
    if (!station) {
      station = await EmergencyStation.findOne({
        name: { $regex: stationId, $options: "i" },
      });
    }

    if (!station) {
      logger.warn(
        `Station not found: ${stationId}, proceeding without station verification`,
      );
    }

    // Verify API key - reject if mismatch
    if (!apiKey) {
      return sendError(res, "API key is required", 401);
    }
    if (
      station &&
      station.apiConfig?.apiKey &&
      station.apiConfig.apiKey !== apiKey
    ) {
      logger.warn(`API key mismatch for station ${stationId}`);
      return sendError(res, "Invalid API key", 403);
    }

    // Update the alert status
    const alert = await EmergencyAlert.findOneAndUpdate(
      { alertId },
      {
        status: "responding",
        ...(station && {
          $set: {
            "sentToStations.$[elem].status": "responding",
            "sentToStations.$[elem].respondedAt": new Date(),
            "sentToStations.$[elem].notes": notes,
          },
        }),
      },
      {
        arrayFilters: station ? [{ "elem.stationId": station._id }] : [],
        new: true,
      },
    );

    if (!alert) {
      return sendError(res, "Alert not found", 404);
    }

    // Update the linked report/need's emergencyStatus - use sourceDocument or sourceId as fallback
    const reportId = alert.sourceDocument || alert.sourceId;
    if (reportId) {
      try {
        const Report = (await import("../models/ReportModel.js")).default;
        const Need = (await import("../models/NeedModel.js")).default;

        const updateData = {
          emergencyStatus: "dispatched",
          ...(station && {
            "assignedStation.stationId": station._id,
            "assignedStation.stationName": station.name,
            "assignedStation.stationType": station.type,
          }),
          "assignedStation.dispatchedAt": new Date(),
        };

        // Try updating Report first, then Need
        const reportUpdate = await Report.findByIdAndUpdate(
          reportId,
          updateData,
        );
        const needUpdate = await Need.findByIdAndUpdate(reportId, updateData);

        if (reportUpdate || needUpdate) {
          logger.info(
            `Updated ${
              reportUpdate ? "report" : "need"
            } ${reportId} emergencyStatus to 'dispatched'`,
          );
        } else {
          logger.warn(`Neither report nor need ${reportId} found for update`);
        }
      } catch (err) {
        logger.error(`Failed to update report/need: ${err.message}`);
      }
    } else {
      logger.warn(`No sourceDocument or sourceId found for alert ${alertId}`);
    }

    // Update station stats if station found
    if (station) {
      await EmergencyStation.findByIdAndUpdate(station._id, {
        $inc: { "stats.totalRespondedAlerts": 1 },
      });
    }

    logger.info(`Dispatch callback processed for alert ${alertId}`);

    sendSuccess(
      res,
      {
        alertId,
        stationId: station?.stationId || stationId,
        stationName: station?.name || stationId,
        status: "responding",
        dispatchedUnits,
        estimatedArrival,
      },
      "Dispatch callback received",
      200,
    );
  } catch (error) {
    logger.error("Error processing dispatch callback:", error);
    sendError(res, "Failed to process dispatch callback", 500);
  }
}

/**
 * POST /api/emergency-stations/callback/rejected
 * Callback from station when alert is rejected
 * This is called by the station website when an alert is rejected
 */
export async function stationRejectCallback(req, res) {
  try {
    const { alertId, stationId, apiKey, reason } = req.body;

    logger.info(
      `Reject callback received: alertId=${alertId}, stationId=${stationId}, reason=${reason}`,
    );

    if (!alertId || !stationId) {
      return sendError(res, "Missing required fields: alertId, stationId", 400);
    }

    if (!apiKey) {
      return sendError(res, "API key is required", 401);
    }

    // Find station flexibly
    let station = await EmergencyStation.findOne({ stationId });
    if (!station) {
      station = await EmergencyStation.findOne({
        name: { $regex: stationId, $options: "i" },
      });
    }

    // Verify API key
    if (
      station &&
      station.apiConfig?.apiKey &&
      station.apiConfig.apiKey !== apiKey
    ) {
      logger.warn(`API key mismatch for station ${stationId}`);
      return sendError(res, "Invalid API key", 403);
    }

    // Update the alert - mark this station as rejected
    const alert = await EmergencyAlert.findOneAndUpdate(
      { alertId },
      {
        ...(station && {
          $set: {
            "sentToStations.$[elem].status": "rejected",
            "sentToStations.$[elem].rejectedAt": new Date(),
            "sentToStations.$[elem].rejectionReason":
              reason || "No reason provided",
          },
        }),
      },
      {
        arrayFilters: station ? [{ "elem.stationId": station._id }] : [],
        new: true,
      },
    );

    if (!alert) {
      return sendError(res, "Alert not found", 404);
    }

    // Check if all stations have rejected - if so, mark the report as rejected for rerouting
    const allRejected =
      alert.sentToStations?.every((s) => s.status === "rejected") || true;

    // Update the linked report/need's emergencyStatus
    const reportId = alert.sourceDocument || alert.sourceId;
    if (reportId) {
      try {
        const Report = (await import("../models/ReportModel.js")).default;
        const Need = (await import("../models/NeedModel.js")).default;
        const mongoose = (await import("mongoose")).default;

        const updateData = {
          emergencyStatus: allRejected ? "rejected" : "pending",
          ...(allRejected && {
            dispatch_status: "Rejected",
            "assignedStation.rejectionReason": reason || "Station rejected",
            "assignedStation.rejectedAt": new Date(),
          }),
        };

        // Try updating Report first, then Need
        const reportUpdate = await Report.findByIdAndUpdate(
          reportId,
          updateData,
        );
        const needUpdate = await Need.findByIdAndUpdate(reportId, updateData);

        logger.info(
          `Updated ${
            reportUpdate ? "report" : "need"
          } ${reportId} emergencyStatus to '${
            allRejected ? "rejected" : "pending"
          }'`,
        );

        // Delete associated mission to remove the route from map when rejected
        if (allRejected) {
          const db = mongoose.connection.db;
          const deletedMission = await db.collection("missions").deleteMany({
            $or: [
              { report_ids: reportId },
              { need_ids: reportId },
              { "routes.sourceId": reportId.toString() },
            ],
          });

          if (deletedMission.deletedCount > 0) {
            logger.info(
              `Deleted ${deletedMission.deletedCount} mission(s) for rejected alert`,
            );
          }
        }
      } catch (err) {
        logger.error(
          `Failed to update report/need or delete mission: ${err.message}`,
        );
      }
    }

    logger.info(`Reject callback processed for alert ${alertId}`);

    sendSuccess(
      res,
      {
        alertId,
        stationId: station?.stationId || stationId,
        stationName: station?.name || stationId,
        status: "rejected",
        reason,
        allStationsRejected: allRejected,
        needsRerouting: allRejected,
      },
      "Rejection callback received",
      200,
    );
  } catch (error) {
    logger.error("Error processing rejection callback:", error);
    sendError(res, "Failed to process rejection callback", 500);
  }
}

/**
 * POST /api/emergency-stations/callback/resolved
 * Callback from station when emergency is resolved
 */
export async function stationResolvedCallback(req, res) {
  try {
    const { alertId, stationId, apiKey, notes, outcome } = req.body;

    logger.info(
      `Resolved callback received: alertId=${alertId}, stationId=${stationId}`,
    );

    if (!alertId || !stationId) {
      return sendError(res, "Missing required fields: alertId, stationId", 400);
    }

    if (!apiKey) {
      return sendError(res, "API key is required", 401);
    }

    // Find station flexibly
    let station = await EmergencyStation.findOne({ stationId });
    if (!station) {
      station = await EmergencyStation.findOne({
        name: { $regex: stationId, $options: "i" },
      });
    }

    // Verify API key
    if (
      station &&
      station.apiConfig?.apiKey &&
      station.apiConfig.apiKey !== apiKey
    ) {
      logger.warn(`API key mismatch for station ${stationId}`);
      return sendError(res, "Invalid API key", 403);
    }

    // Update the alert status
    const alert = await EmergencyAlert.findOneAndUpdate(
      { alertId },
      {
        status: "resolved",
        resolvedAt: new Date(),
        ...(station && {
          $set: {
            "sentToStations.$[elem].status": "resolved",
            "sentToStations.$[elem].resolvedAt": new Date(),
            "sentToStations.$[elem].notes": notes,
          },
        }),
      },
      {
        arrayFilters: station ? [{ "elem.stationId": station._id }] : [],
        new: true,
      },
    );

    if (!alert) {
      return sendError(res, "Alert not found", 404);
    }

    // Update the linked report/need's emergencyStatus and delete associated mission
    const reportId = alert.sourceDocument || alert.sourceId;
    if (reportId) {
      try {
        const Report = (await import("../models/ReportModel.js")).default;
        const Need = (await import("../models/NeedModel.js")).default;
        const mongoose = (await import("mongoose")).default;

        const updateData = {
          emergencyStatus: "resolved",
          status: "Completed",
          "assignedStation.resolvedAt": new Date(),
        };

        // Try updating Report first, then Need
        const reportUpdate = await Report.findByIdAndUpdate(
          reportId,
          updateData,
        );
        const needUpdate = await Need.findByIdAndUpdate(reportId, updateData);

        logger.info(
          `Updated ${
            reportUpdate ? "report" : "need"
          } ${reportId} emergencyStatus to 'resolved'`,
        );

        // Delete associated mission to remove the route from map
        const db = mongoose.connection.db;
        const deletedMission = await db.collection("missions").deleteMany({
          $or: [
            { report_ids: reportId },
            { need_ids: reportId },
            { "routes.sourceId": reportId.toString() },
          ],
        });

        if (deletedMission.deletedCount > 0) {
          logger.info(
            `Deleted ${deletedMission.deletedCount} mission(s) for resolved alert`,
          );
        }
      } catch (err) {
        logger.error(
          `Failed to update report/need or delete mission: ${err.message}`,
        );
      }
    }

    // Update station stats if station found
    if (station) {
      await EmergencyStation.findByIdAndUpdate(station._id, {
        $inc: { "stats.totalResolvedAlerts": 1 },
      });
    }

    logger.info(`Resolved callback processed for alert ${alertId}`);

    sendSuccess(
      res,
      {
        alertId,
        stationId: station?.stationId || stationId,
        stationName: station?.name || stationId,
        status: "resolved",
        outcome,
      },
      "Resolved callback received",
      200,
    );
  } catch (error) {
    logger.error("Error processing resolved callback:", error);
    sendError(res, "Failed to process resolved callback", 500);
  }
}

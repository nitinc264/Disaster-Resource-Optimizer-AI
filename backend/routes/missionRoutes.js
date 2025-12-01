import express from "express";
import mongoose from "mongoose";
import { sendSuccess, sendError } from "../utils/apiResponse.js";
import { logger } from "../utils/appLogger.js";
import { HTTP_STATUS } from "../constants/index.js";

const router = express.Router();

/**
 * GET /api/missions
 * Get all active missions with their routes
 */
router.get("/missions", async (req, res) => {
  try {
    const { status = "Active" } = req.query;

    const missions = await mongoose.connection.db
      .collection("missions")
      .find(status ? { status } : {})
      .sort({ timestamp: -1 })
      .limit(20)
      .toArray();

    // Transform for frontend
    const transformedMissions = missions.map((mission) => ({
      id: mission._id.toString(),
      routes: mission.routes || [],
      reportIds: mission.report_ids || [],
      status: mission.status,
      numVehicles: mission.num_vehicles,
      timestamp: mission.timestamp,
      station: mission.station || null,
    }));

    sendSuccess(res, transformedMissions, "Missions fetched successfully");
  } catch (error) {
    logger.error("Error fetching missions:", error);
    sendError(
      res,
      "Failed to fetch missions",
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      error.message
    );
  }
});

/**
 * GET /api/missions/latest
 * Get the most recent active mission
 */
router.get("/missions/latest", async (req, res) => {
  try {
    const mission = await mongoose.connection.db
      .collection("missions")
      .findOne({ status: "Active" }, { sort: { timestamp: -1 } });

    if (!mission) {
      return sendSuccess(res, null, "No active mission found");
    }

    const transformed = {
      id: mission._id.toString(),
      routes: mission.routes || [],
      reportIds: mission.report_ids || [],
      status: mission.status,
      numVehicles: mission.num_vehicles,
      timestamp: mission.timestamp,
      station: mission.station || null,
    };

    sendSuccess(res, transformed, "Latest mission fetched");
  } catch (error) {
    logger.error("Error fetching latest mission:", error);
    sendError(
      res,
      "Failed to fetch mission",
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      error.message
    );
  }
});

/**
 * PATCH /api/missions/:id/complete
 * Mark a mission as complete and update related reports/needs
 */
router.patch("/missions/:id/complete", async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, "Invalid mission ID", HTTP_STATUS.BAD_REQUEST);
    }

    // Get the mission first to find related report IDs
    const mission = await mongoose.connection.db
      .collection("missions")
      .findOne({ _id: new mongoose.Types.ObjectId(id) });

    if (!mission) {
      return sendError(res, "Mission not found", HTTP_STATUS.NOT_FOUND);
    }

    // Update mission status to Completed
    await mongoose.connection.db.collection("missions").updateOne(
      { _id: new mongoose.Types.ObjectId(id) },
      {
        $set: {
          status: "Completed",
          completedAt: new Date().toISOString(),
        },
      }
    );

    // Update related reports to Completed status
    if (mission.report_ids && mission.report_ids.length > 0) {
      // report_ids may already be ObjectIds from Python agent
      const reportObjectIds = mission.report_ids
        .map((rid) => {
          if (rid instanceof mongoose.Types.ObjectId) return rid;
          if (typeof rid === "object" && rid.$oid)
            return new mongoose.Types.ObjectId(rid.$oid);
          if (mongoose.Types.ObjectId.isValid(rid))
            return new mongoose.Types.ObjectId(rid);
          return null;
        })
        .filter(Boolean);

      if (reportObjectIds.length > 0) {
        await mongoose.connection.db
          .collection("reports")
          .updateMany(
            { _id: { $in: reportObjectIds } },
            { $set: { status: "Completed" } }
          );
        logger.info(`Updated ${reportObjectIds.length} reports to Completed`);
      }
    }

    // Update related needs to Completed status
    if (mission.need_ids && mission.need_ids.length > 0) {
      // need_ids may already be ObjectIds from Python agent
      const needObjectIds = mission.need_ids
        .map((nid) => {
          if (nid instanceof mongoose.Types.ObjectId) return nid;
          if (typeof nid === "object" && nid.$oid)
            return new mongoose.Types.ObjectId(nid.$oid);
          if (mongoose.Types.ObjectId.isValid(nid))
            return new mongoose.Types.ObjectId(nid);
          return null;
        })
        .filter(Boolean);

      if (needObjectIds.length > 0) {
        await mongoose.connection.db
          .collection("needs")
          .updateMany(
            { _id: { $in: needObjectIds } },
            { $set: { status: "Completed" } }
          );
        logger.info(`Updated ${needObjectIds.length} needs to Completed`);
      }
    }

    logger.info(`Mission ${id} marked as complete`);
    sendSuccess(res, { id, status: "Completed" }, "Mission completed");
  } catch (error) {
    logger.error("Error completing mission:", error);
    sendError(
      res,
      "Failed to complete mission",
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      error.message
    );
  }
});

/**
 * PATCH /api/missions/:id/reroute
 * Re-route a mission to a different station
 * This marks the old mission as cancelled and triggers re-routing
 */
router.patch("/missions/:id/reroute", async (req, res) => {
  try {
    const { id } = req.params;
    const { station } = req.body; // { type, name, lat, lon }

    if (!station || !station.type || !station.name) {
      return sendError(res, "Station info required", HTTP_STATUS.BAD_REQUEST);
    }

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, "Invalid mission ID", HTTP_STATUS.BAD_REQUEST);
    }

    // Get the current mission
    const mission = await mongoose.connection.db
      .collection("missions")
      .findOne({ _id: new mongoose.Types.ObjectId(id) });

    if (!mission) {
      return sendError(res, "Mission not found", HTTP_STATUS.NOT_FOUND);
    }

    // Mark current mission as re-routed (cancelled)
    await mongoose.connection.db.collection("missions").updateOne(
      { _id: new mongoose.Types.ObjectId(id) },
      {
        $set: {
          status: "Rerouted",
          reroutedAt: new Date().toISOString(),
          reroutedTo: station,
        },
      }
    );

    // Reset related reports back to Analyzed status for re-processing
    if (mission.report_ids && mission.report_ids.length > 0) {
      const reportObjectIds = mission.report_ids
        .map((rid) => {
          if (rid instanceof mongoose.Types.ObjectId) return rid;
          if (typeof rid === "object" && rid.$oid)
            return new mongoose.Types.ObjectId(rid.$oid);
          if (mongoose.Types.ObjectId.isValid(rid))
            return new mongoose.Types.ObjectId(rid);
          return null;
        })
        .filter(Boolean);

      if (reportObjectIds.length > 0) {
        await mongoose.connection.db.collection("reports").updateMany(
          { _id: { $in: reportObjectIds } },
          {
            $set: {
              status: "Analyzed",
              dispatch_status: "Pending",
              rerouted_to_station: station,
            },
            $unset: { mission_id: "", assigned_station: "" },
          }
        );
        logger.info(
          `Reset ${reportObjectIds.length} reports for re-routing to ${station.name}`
        );
      }
    }

    // Reset related needs back to Verified status for re-processing
    if (mission.need_ids && mission.need_ids.length > 0) {
      const needObjectIds = mission.need_ids
        .map((nid) => {
          if (nid instanceof mongoose.Types.ObjectId) return nid;
          if (typeof nid === "object" && nid.$oid)
            return new mongoose.Types.ObjectId(nid.$oid);
          if (mongoose.Types.ObjectId.isValid(nid))
            return new mongoose.Types.ObjectId(nid);
          return null;
        })
        .filter(Boolean);

      if (needObjectIds.length > 0) {
        await mongoose.connection.db.collection("needs").updateMany(
          { _id: { $in: needObjectIds } },
          {
            $set: {
              status: "Verified",
              dispatch_status: "Pending",
              rerouted_to_station: station,
            },
            $unset: { mission_id: "", assigned_station: "" },
          }
        );
        logger.info(
          `Reset ${needObjectIds.length} needs for re-routing to ${station.name}`
        );
      }
    }

    logger.info(`Mission ${id} re-routed to ${station.name}`);
    sendSuccess(
      res,
      { id, status: "Rerouted", newStation: station },
      `Mission re-routed to ${station.name}. Logistics agent will process shortly.`
    );
  } catch (error) {
    logger.error("Error re-routing mission:", error);
    sendError(
      res,
      "Failed to re-route mission",
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      error.message
    );
  }
});

export default router;

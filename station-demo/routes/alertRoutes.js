import express from "express";
import Alert from "../models/AlertModel.js";
import axios from "axios";

const router = express.Router();

/**
 * Middleware to verify API key
 */
function verifyApiKey(req, res, next) {
  const apiKey = req.headers["x-api-key"];
  const stationConfig = req.app.get("stationConfig");

  // For demo purposes, accept any key or the configured key
  // In production, this should be strictly validated
  if (!apiKey) {
    console.warn(`[${stationConfig.name}] Request without API key`);
  }

  next();
}

/**
 * POST /api/alerts/receive
 * Receive alert from main disaster response platform
 */
router.post("/alerts/receive", verifyApiKey, async (req, res) => {
  const io = req.app.get("io");
  const stationConfig = req.app.get("stationConfig");

  try {
    const {
      alertId,
      emergencyType,
      severity,
      location,
      title,
      description,
      needs,
      timestamp,
      fromStation,
    } = req.body;

    console.log(`\n${"=".repeat(60)}`);
    console.log(`🚨 INCOMING ALERT - ${stationConfig.name}`);
    console.log(`${"=".repeat(60)}`);
    console.log(`Alert ID: ${alertId}`);
    console.log(`Type: ${emergencyType}`);
    console.log(`Severity: ${severity}/10`);
    console.log(`Title: ${title}`);
    console.log(`Location: ${location.lat}, ${location.lng}`);
    console.log(`${"=".repeat(60)}\n`);

    // Check if alert already exists
    let alert = await Alert.findOne({ alertId });

    if (alert) {
      return res.status(200).json({
        success: true,
        message: "Alert already received",
        alertId,
      });
    }

    // Create new alert
    alert = new Alert({
      alertId,
      emergencyType,
      severity,
      location,
      title,
      description,
      needs,
      fromStation,
      originalTimestamp: timestamp,
      status: "received",
    });

    await alert.save();

    // Emit to all connected dashboards
    io.emit("newAlert", {
      ...alert.toObject(),
      playSound: true,
      priority: severity >= 7 ? "critical" : "normal",
    });

    console.log(
      `[${stationConfig.name}] Alert saved and broadcasted to dashboards`
    );

    res.status(200).json({
      success: true,
      message: "Alert received and processed",
      alertId,
      stationId: stationConfig.stationId,
      stationName: stationConfig.name,
    });
  } catch (error) {
    console.error(`[${stationConfig.name}] Error processing alert:`, error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/alerts
 * Get all alerts for this station
 */
router.get("/alerts", async (req, res) => {
  const stationConfig = req.app.get("stationConfig");

  try {
    const { status, limit = 50 } = req.query;

    const filter = {};
    if (status) filter.status = status;

    const alerts = await Alert.find(filter)
      .sort({ severity: -1, createdAt: -1 })
      .limit(parseInt(limit));

    res.json({
      success: true,
      station: stationConfig.name,
      count: alerts.length,
      alerts,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/alerts/:alertId
 * Get a specific alert
 */
router.get("/alerts/:alertId", async (req, res) => {
  try {
    const alert = await Alert.findOne({ alertId: req.params.alertId });

    if (!alert) {
      return res.status(404).json({
        success: false,
        error: "Alert not found",
      });
    }

    res.json({
      success: true,
      alert,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * PUT /api/alerts/:alertId/acknowledge
 * Acknowledge an alert
 */
router.put("/alerts/:alertId/acknowledge", async (req, res) => {
  const io = req.app.get("io");
  const stationConfig = req.app.get("stationConfig");

  try {
    const alert = await Alert.findOneAndUpdate(
      { alertId: req.params.alertId },
      {
        status: "acknowledged",
        acknowledgedAt: new Date(),
      },
      { new: true }
    );

    if (!alert) {
      return res.status(404).json({
        success: false,
        error: "Alert not found",
      });
    }

    // Notify main platform about acknowledgment
    try {
      const mainPlatformUrl =
        process.env.MAIN_PLATFORM_URL || "http://localhost:5000";
      await axios.post(
        `${mainPlatformUrl}/api/emergency-stations/alerts/${alert.alertId}/acknowledge`,
        {
          stationId: stationConfig.stationId,
          notes: req.body.notes || "Alert acknowledged",
        }
      );
    } catch (err) {
      console.warn("Could not notify main platform:", err.message);
    }

    // Broadcast update
    io.emit("alertUpdated", alert);

    res.json({
      success: true,
      message: "Alert acknowledged",
      alert,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * PUT /api/alerts/:alertId/status
 * Update alert status
 */
router.put("/alerts/:alertId/status", async (req, res) => {
  const io = req.app.get("io");

  try {
    const { status, notes } = req.body;

    const updates = { status };

    // Add timestamp based on status
    if (status === "acknowledged") updates.acknowledgedAt = new Date();
    if (status === "dispatched") updates.dispatchedAt = new Date();
    if (status === "on_scene") updates.arrivedAt = new Date();
    if (status === "resolved") updates.resolvedAt = new Date();

    // Add notes if provided
    if (notes) {
      updates.$push = {
        notes: {
          text: notes,
          createdAt: new Date(),
        },
      };
    }

    const alert = await Alert.findOneAndUpdate(
      { alertId: req.params.alertId },
      updates,
      { new: true }
    );

    if (!alert) {
      return res.status(404).json({
        success: false,
        error: "Alert not found",
      });
    }

    // Broadcast update
    io.emit("alertUpdated", alert);

    res.json({
      success: true,
      alert,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/alerts/:alertId/dispatch
 * Dispatch units to an alert
 */
router.post("/alerts/:alertId/dispatch", async (req, res) => {
  const io = req.app.get("io");
  const stationConfig = req.app.get("stationConfig");

  try {
    const { unitId, unitName, estimatedArrival, notes } = req.body;

    const alert = await Alert.findOneAndUpdate(
      { alertId: req.params.alertId },
      {
        status: "dispatched",
        dispatchedAt: new Date(),
        $push: {
          assignedUnits: {
            unitId,
            unitName,
            assignedAt: new Date(),
          },
        },
      },
      { new: true }
    );

    if (!alert) {
      return res.status(404).json({
        success: false,
        error: "Alert not found",
      });
    }

    // Send callback to main platform
    try {
      const mainPlatformUrl =
        process.env.MAIN_PLATFORM_URL || "http://localhost:3000";
      const apiKey = stationConfig.apiKey || process.env.STATION_API_KEY;

      console.log(
        `[${stationConfig.name}] Sending dispatch callback to ${mainPlatformUrl}/api/emergency-stations/callback/dispatched`
      );
      console.log(
        `[${stationConfig.name}] Payload: alertId=${alert.alertId}, stationId=${stationConfig.stationId}`
      );

      const response = await axios.post(
        `${mainPlatformUrl}/api/emergency-stations/callback/dispatched`,
        {
          alertId: alert.alertId,
          stationId: stationConfig.stationId,
          apiKey: apiKey,
          dispatchedUnits: [{ unitId, unitName }],
          estimatedArrival: estimatedArrival || "15 minutes",
          notes: notes || `Unit ${unitName || unitId} dispatched`,
        }
      );

      console.log(
        `[${stationConfig.name}] Dispatch callback response:`,
        response.data
      );
    } catch (err) {
      console.error(
        `[${stationConfig.name}] Could not notify main platform of dispatch:`,
        err.response?.data || err.message
      );
    }

    // Broadcast update
    io.emit("alertUpdated", alert);
    io.emit("unitDispatched", {
      alertId: alert.alertId,
      unitId,
      unitName,
      location: alert.location,
    });

    res.json({
      success: true,
      message: "Unit dispatched",
      alert,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/alerts/:alertId/reject
 * Reject an alert (station cannot handle it)
 */
router.post("/alerts/:alertId/reject", async (req, res) => {
  const io = req.app.get("io");
  const stationConfig = req.app.get("stationConfig");

  try {
    const { reason } = req.body;

    const alert = await Alert.findOneAndUpdate(
      { alertId: req.params.alertId },
      {
        status: "rejected",
        rejectedAt: new Date(),
        rejectionReason: reason || "No reason provided",
      },
      { new: true }
    );

    if (!alert) {
      return res.status(404).json({
        success: false,
        error: "Alert not found",
      });
    }

    // Send callback to main platform
    try {
      const mainPlatformUrl =
        process.env.MAIN_PLATFORM_URL || "http://localhost:3000";
      const apiKey = stationConfig.apiKey || process.env.STATION_API_KEY;

      await axios.post(
        `${mainPlatformUrl}/api/emergency-stations/callback/rejected`,
        {
          alertId: alert.alertId,
          stationId: stationConfig.stationId,
          apiKey: apiKey,
          reason: reason || "Station unable to respond",
        }
      );

      console.log(
        `[${stationConfig.name}] Rejection callback sent to main platform for alert ${alert.alertId}`
      );
    } catch (err) {
      console.warn(
        `[${stationConfig.name}] Could not notify main platform of rejection:`,
        err.message
      );
    }

    // Broadcast update
    io.emit("alertUpdated", alert);
    io.emit("alertRejected", {
      alertId: alert.alertId,
      reason: reason,
    });

    res.json({
      success: true,
      message: "Alert rejected",
      alert,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/alerts/:alertId/resolve
 * Mark an alert as resolved
 */
router.post("/alerts/:alertId/resolve", async (req, res) => {
  const io = req.app.get("io");
  const stationConfig = req.app.get("stationConfig");

  try {
    const { notes, outcome } = req.body;

    const alert = await Alert.findOneAndUpdate(
      { alertId: req.params.alertId },
      {
        status: "resolved",
        resolvedAt: new Date(),
        $push: notes
          ? {
              notes: {
                text: notes,
                createdAt: new Date(),
              },
            }
          : undefined,
      },
      { new: true }
    );

    if (!alert) {
      return res.status(404).json({
        success: false,
        error: "Alert not found",
      });
    }

    // Send callback to main platform
    try {
      const mainPlatformUrl =
        process.env.MAIN_PLATFORM_URL || "http://localhost:3000";
      const apiKey = stationConfig.apiKey || process.env.STATION_API_KEY;

      await axios.post(
        `${mainPlatformUrl}/api/emergency-stations/callback/resolved`,
        {
          alertId: alert.alertId,
          stationId: stationConfig.stationId,
          apiKey: apiKey,
          notes: notes,
          outcome: outcome || "Emergency resolved",
        }
      );

      console.log(
        `[${stationConfig.name}] Resolved callback sent to main platform for alert ${alert.alertId}`
      );
    } catch (err) {
      console.warn(
        `[${stationConfig.name}] Could not notify main platform of resolution:`,
        err.message
      );
    }

    // Broadcast update
    io.emit("alertUpdated", alert);
    io.emit("alertResolved", {
      alertId: alert.alertId,
      outcome: outcome,
    });

    res.json({
      success: true,
      message: "Alert resolved",
      alert,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/stats
 * Get station statistics
 */
router.get("/stats", async (req, res) => {
  const stationConfig = req.app.get("stationConfig");

  try {
    const totalAlerts = await Alert.countDocuments();
    const activeAlerts = await Alert.countDocuments({
      status: { $nin: ["resolved"] },
    });
    const criticalAlerts = await Alert.countDocuments({
      severity: { $gte: 7 },
      status: { $nin: ["resolved"] },
    });
    const resolvedToday = await Alert.countDocuments({
      status: "resolved",
      resolvedAt: { $gte: new Date().setHours(0, 0, 0, 0) },
    });

    res.json({
      success: true,
      station: stationConfig.name,
      stats: {
        totalAlerts,
        activeAlerts,
        criticalAlerts,
        resolvedToday,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;

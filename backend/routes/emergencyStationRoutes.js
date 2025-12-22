import express from "express";
import {
  getAllStations,
  getStation,
  createStation,
  updateStation,
  deleteStation,
  pingStationEndpoint,
  updateStatusEndpoint,
  findNearestStations,
  getAllAlerts,
  getAlert,
  dispatchAlert,
  acknowledgeAlert,
  updateAlertStatus,
  stationDispatchCallback,
  stationRejectCallback,
  stationResolvedCallback,
} from "../controllers/emergencyStationController.js";
import { requireAuth, requireManager } from "../middleware/authMiddleware.js";

const router = express.Router();

// ============================================================================
// STATION CALLBACK ROUTES (from external station websites - no auth, use API key)
// These must come first to avoid conflicts with other routes
// ============================================================================

/**
 * @route   POST /api/emergency-stations/callback/dispatched
 * @desc    Callback when station dispatches units
 * @access  Public (stations authenticate via API key in body)
 */
router.post("/callback/dispatched", stationDispatchCallback);

/**
 * @route   POST /api/emergency-stations/callback/rejected
 * @desc    Callback when station rejects an alert
 * @access  Public (stations authenticate via API key in body)
 */
router.post("/callback/rejected", stationRejectCallback);

/**
 * @route   POST /api/emergency-stations/callback/resolved
 * @desc    Callback when station resolves an emergency
 * @access  Public (stations authenticate via API key in body)
 */
router.post("/callback/resolved", stationResolvedCallback);

// ============================================================================
// EMERGENCY STATION ROUTES
// ============================================================================

/**
 * @route   GET /api/emergency-stations/nearest
 * @desc    Find nearest stations to a location
 * @access  Public
 */
router.get("/nearest", findNearestStations);

// ============================================================================
// EMERGENCY ALERT ROUTES (must come before /:id to avoid conflicts)
// ============================================================================

/**
 * @route   GET /api/emergency-stations/alerts
 * @desc    Get all emergency alerts
 * @access  Protected
 */
router.get("/alerts", requireAuth, getAllAlerts);

/**
 * @route   GET /api/emergency-stations/alerts/:alertId
 * @desc    Get a specific alert
 * @access  Protected
 */
router.get("/alerts/:alertId", requireAuth, getAlert);

/**
 * @route   POST /api/emergency-stations/alerts/dispatch
 * @desc    Manually dispatch an emergency alert
 * @access  Manager only
 */
router.post("/alerts/dispatch", requireAuth, requireManager, dispatchAlert);

/**
 * @route   POST /api/emergency-stations/alerts/:alertId/acknowledge
 * @desc    Acknowledge an alert (called by station)
 * @access  Public (stations use API key)
 */
router.post("/alerts/:alertId/acknowledge", acknowledgeAlert);

/**
 * @route   PUT /api/emergency-stations/alerts/:alertId/status
 * @desc    Update alert status
 * @access  Manager only
 */
router.put(
  "/alerts/:alertId/status",
  requireAuth,
  requireManager,
  updateAlertStatus
);

// ============================================================================
// STATION ROUTES
// ============================================================================

/**
 * @route   GET /api/emergency-stations
 * @desc    Get all registered emergency stations
 * @access  Public
 */
router.get("/", getAllStations);

/**
 * @route   GET /api/emergency-stations/:id
 * @desc    Get a specific emergency station
 * @access  Public
 */
router.get("/:id", getStation);

/**
 * @route   POST /api/emergency-stations
 * @desc    Register a new emergency station
 * @access  Manager only
 */
router.post("/", requireAuth, requireManager, createStation);

/**
 * @route   PUT /api/emergency-stations/:id
 * @desc    Update an emergency station
 * @access  Manager only
 */
router.put("/:id", requireAuth, requireManager, updateStation);

/**
 * @route   DELETE /api/emergency-stations/:id
 * @desc    Delete an emergency station
 * @access  Manager only
 */
router.delete("/:id", requireAuth, requireManager, deleteStation);

/**
 * @route   POST /api/emergency-stations/:id/ping
 * @desc    Ping a station to check if it's online
 * @access  Manager only
 */
router.post("/:id/ping", requireAuth, requireManager, pingStationEndpoint);

/**
 * @route   PUT /api/emergency-stations/:id/status
 * @desc    Update station status
 * @access  Manager only
 */
router.post("/:id/status", requireAuth, requireManager, updateStatusEndpoint);

export default router;

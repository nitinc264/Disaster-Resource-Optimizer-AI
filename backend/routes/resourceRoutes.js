/**
 * Resource Station Routes
 * API endpoints for managing resource stations, fleet, personnel, and supplies
 */

import express from "express";
import {
  getAllStations,
  getStation,
  createStation,
  updateStation,
  deleteStation,
  getResourceSummary,
  deployResources,
  returnResources,
} from "../controllers/resourceController.js";
import { requireAuth, requireManager } from "../middleware/authMiddleware.js";

const router = express.Router();

// Summary (aggregated data across all stations)
router.get("/summary", requireAuth, getResourceSummary);

// CRUD for stations
router.get("/stations", requireAuth, getAllStations);
router.get("/stations/:id", requireAuth, getStation);
router.post("/stations", requireManager, createStation);
router.patch("/stations/:id", requireAuth, updateStation);
router.delete("/stations/:id", requireManager, deleteStation);

// Deployment operations
router.patch("/stations/:id/deploy", requireAuth, deployResources);
router.patch("/stations/:id/return", requireAuth, returnResources);

export default router;

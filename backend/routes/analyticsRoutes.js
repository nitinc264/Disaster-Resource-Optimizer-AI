import express from "express";
import { getAnalytics } from "../controllers/analyticsController.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

/**
 * GET /api/analytics
 * Get dashboard analytics data
 */
router.get("/analytics", requireAuth, getAnalytics);

export default router;

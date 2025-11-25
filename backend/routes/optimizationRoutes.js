import express from "express";
import { optimizeRouteHandler } from "../controllers/deliveryRouteController.js";

const router = express.Router();

/**
 * POST /api/optimize-route
 * Route optimization endpoint
 *
 * Request Body:
 * - depot: { lat: number, lon: number } - Starting/ending location
 * - stops: Array<{ lat: number, lon: number }> - Locations to visit
 *
 * Response:
 * - optimized_route: Array of locations in optimized order
 */
router.post("/optimize-route", optimizeRouteHandler);

export default router;

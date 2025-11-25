import { optimizeRoute } from "../services/deliveryRouteOptimizer.js";
import { asyncHandler, ApiError } from "../middleware/index.js";
import { validateOptimizationRequest } from "../validators/index.js";
import { sendSuccess } from "../utils/apiResponse.js";
import { logger } from "../utils/appLogger.js";

/**
 * POST /api/optimize-route
 * Optimizes a delivery route from depot to multiple stops
 */
export const optimizeRouteHandler = asyncHandler(async (req, res) => {
  // Validate request
  const errors = validateOptimizationRequest(req.body);
  if (errors.length > 0) {
    throw new ApiError(400, "Validation failed", errors);
  }

  const { depot, stops } = req.body;

  logger.debug(`Optimizing route with ${stops.length} stops`);

  const orderedRoute = optimizeRoute({ depot, stops });

  logger.info(
    `Route optimized successfully with ${orderedRoute.length} waypoints`
  );

  sendSuccess(
    res,
    { optimized_route: orderedRoute },
    "Route optimized successfully"
  );
});

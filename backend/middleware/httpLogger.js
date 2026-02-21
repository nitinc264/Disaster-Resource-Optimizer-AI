import { logger } from "../utils/appLogger.js";

/**
 * Request logging middleware
 */
export function requestLogger(req, res, next) {
  const start = Date.now();
  const { method, url, ip } = req;

  // Log request
  logger.debug(`${method} ${url} - IP: ${ip}`);

  // Log response when finished
  res.on("finish", () => {
    const duration = Date.now() - start;
    const { statusCode } = res;
    logger.debug(
      `${method} ${url} - Status: ${statusCode} - Duration: ${duration}ms`,
    );
  });

  next();
}

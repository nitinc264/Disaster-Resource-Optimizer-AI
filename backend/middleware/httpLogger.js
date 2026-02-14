/**
 * Request logging middleware
 */
export function requestLogger(req, res, next) {
  const start = Date.now();
  const { method, url, ip } = req;

  // Log request
  console.log(`[REQUEST] ${method} ${url} - IP: ${ip}`);

  // Log response when finished
  res.on("finish", () => {
    const duration = Date.now() - start;
    const { statusCode } = res;
    console.log(
      `[RESPONSE] ${method} ${url} - Status: ${statusCode} - Duration: ${duration}ms`,
    );
  });

  next();
}

/**
 * Standardized response formatters for API responses
 */

/**
 * Send success response with proper status code
 * @param {Object} res - Express response object
 * @param {*} data - Response data
 * @param {string} message - Success message
 * @param {number} statusCode - HTTP status code (default 200)
 */
export function sendSuccess(res, data, message = "Success", statusCode = 200) {
  res.status(statusCode).json({
    success: true,
    message,
    data,
  });
}

/**
 * Send error response with proper status code
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code (default 500)
 * @param {*} details - Optional error details
 */
export function sendError(res, message, statusCode = 500, details = null) {
  res.status(statusCode).json({
    success: false,
    error: {
      message,
      ...(details && { details }),
    },
  });
}

/**
 * Standardized response formatters for API responses
 */

/**
 * Format a successful response
 * @param {*} data - Response data
 * @param {string} message - Optional success message
 * @returns {Object} - Formatted response object
 */
export function successResponse(data, message = "Success") {
  return {
    success: true,
    message,
    data,
  };
}

/**
 * Format an error response
 * @param {string} message - Error message
 * @param {*} details - Optional error details
 * @returns {Object} - Formatted error response
 */
export function errorResponse(message, details = null) {
  return {
    success: false,
    error: {
      message,
      ...(details && { details }),
    },
  };
}

/**
 * Format a paginated response
 * @param {Array} data - Array of items
 * @param {Object} pagination - Pagination details
 * @returns {Object} - Formatted paginated response
 */
export function paginatedResponse(data, pagination) {
  return {
    success: true,
    data,
    pagination: {
      page: pagination.page || 1,
      limit: pagination.limit || 10,
      total: pagination.total || data.length,
      totalPages: Math.ceil(
        (pagination.total || data.length) / (pagination.limit || 10)
      ),
    },
  };
}

/**
 * Send success response with proper status code
 * @param {Object} res - Express response object
 * @param {*} data - Response data
 * @param {string} message - Success message
 * @param {number} statusCode - HTTP status code (default 200)
 */
export function sendSuccess(res, data, message = "Success", statusCode = 200) {
  res.status(statusCode).json(successResponse(data, message));
}

/**
 * Send error response with proper status code
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code (default 500)
 * @param {*} details - Optional error details
 */
export function sendError(res, message, statusCode = 500, details = null) {
  res.status(statusCode).json(errorResponse(message, details));
}

export default {
  successResponse,
  errorResponse,
  paginatedResponse,
  sendSuccess,
  sendError,
};

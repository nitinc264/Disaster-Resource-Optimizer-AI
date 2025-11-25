/**
 * Validation functions for route optimization requests
 */

/**
 * Validate location object structure
 * @param {Object} location - Location object to validate
 * @returns {Array<string>} - Array of error messages
 */
export function validateLocation(location, fieldName = "location") {
  const errors = [];

  if (!location) {
    errors.push(`${fieldName} is required`);
    return errors;
  }

  if (typeof location.lat !== "number" || isNaN(location.lat)) {
    errors.push(`${fieldName}.lat must be a valid number`);
  }

  if (typeof location.lon !== "number" && typeof location.lng !== "number") {
    errors.push(`${fieldName} must have either 'lon' or 'lng' property`);
  }

  if (location.lat < -90 || location.lat > 90) {
    errors.push(`${fieldName}.lat must be between -90 and 90`);
  }

  const lon = location.lon || location.lng;
  if (lon < -180 || lon > 180) {
    errors.push(`${fieldName}.lon/lng must be between -180 and 180`);
  }

  return errors;
}

/**
 * Validate route optimization request
 * @param {Object} body - Request body
 * @returns {Array<string>} - Array of error messages
 */
export function validateOptimizationRequest(body) {
  const errors = [];

  // Validate depot
  if (!body.depot) {
    errors.push("depot is required");
  } else {
    errors.push(...validateLocation(body.depot, "depot"));
  }

  // Validate stops
  if (!body.stops) {
    errors.push("stops is required");
  } else if (!Array.isArray(body.stops)) {
    errors.push("stops must be an array");
  } else if (body.stops.length === 0) {
    errors.push("stops array must not be empty");
  } else {
    body.stops.forEach((stop, index) => {
      errors.push(...validateLocation(stop, `stops[${index}]`));
    });
  }

  return errors;
}

export default {
  validateOptimizationRequest,
  validateLocation,
};

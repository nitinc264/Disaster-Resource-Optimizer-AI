import fetch from "node-fetch";
import config from "../config/index.js";
import { logger } from "../utils/appLogger.js";

const NOMINATIM_BASE_URL = "https://nominatim.openstreetmap.org/search";
const DEFAULT_REGION = config.geocode.defaultRegion;
const USER_AGENT = "DisasterResponseOptimizer/1.0";

/**
 * Clean and normalize a location string for better geocoding results
 */
function normalizeLocation(location) {
  return location
    .replace(/[,]+/g, ", ") // Normalize commas
    .replace(/\s+/g, " ") // Normalize whitespace
    .replace(/['"]/g, "") // Remove quotes
    .trim();
}

/**
 * Generate multiple query variations for a location to improve geocoding success
 */
function generateQueryVariations(location) {
  const normalized = normalizeLocation(location);
  const variations = [];

  // Strategy 1: Full location with region
  if (DEFAULT_REGION) {
    variations.push(`${normalized}, ${DEFAULT_REGION}`);
  }

  // Strategy 2: Full location without region
  variations.push(normalized);

  // Strategy 3: Extract meaningful parts (split by common separators)
  const parts = normalized
    .split(/[,\-&@]/g)
    .map((p) => p.trim())
    .filter(Boolean);

  // Try each part individually with region
  for (const part of parts) {
    if (part.length > 3 && DEFAULT_REGION) {
      variations.push(`${part}, ${DEFAULT_REGION}`);
    }
  }

  // Strategy 4: Try the last significant location part (often the most specific)
  if (parts.length > 1) {
    const lastPart = parts[parts.length - 1];
    if (lastPart.length > 3 && DEFAULT_REGION) {
      variations.push(`${lastPart}, ${DEFAULT_REGION}`);
    }
  }

  // Strategy 5: Try combining first and last parts
  if (parts.length > 2 && DEFAULT_REGION) {
    variations.push(
      `${parts[0]}, ${parts[parts.length - 1]}, ${DEFAULT_REGION}`,
    );
  }

  // Remove duplicates while preserving order
  return [...new Set(variations)];
}

/**
 * Perform a single geocoding request to Nominatim
 */
async function geocodeQuery(query) {
  const url = new URL(NOMINATIM_BASE_URL);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("addressdetails", "1");

  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/json",
    },
    timeout: config.geocode.timeout,
  });

  if (!response.ok) {
    throw new Error(`Geocode request failed with status ${response.status}`);
  }

  const data = await response.json();
  if (Array.isArray(data) && data.length > 0) {
    return data[0];
  }

  return null;
}

/**
 * Geocode a human readable location into latitude/longitude using OSM Nominatim.
 * Uses multiple query strategies to maximize success rate.
 * @param {string} location - Human readable location string
 * @returns {Promise<{lat:number, lon:number, formattedAddress:string} | null>}
 */
export async function geocodeLocation(location) {
  if (!location) {
    logger.debug("No location provided for geocoding");
    return null;
  }

  const queryVariations = generateQueryVariations(location);
  logger.debug(
    `Geocoding "${location}" with ${queryVariations.length} query variations`,
  );

  for (const query of queryVariations) {
    try {
      logger.debug(`Trying geocode query: "${query}"`);
      const result = await geocodeQuery(query);

      if (result) {
        logger.info(
          `Geocoded "${location}" → (${result.lat}, ${result.lon}) using query: "${query}"`,
        );
        return {
          lat: Number(result.lat),
          lng: Number(result.lon),
          formattedAddress: result.display_name,
        };
      }

      // Rate limit: Nominatim requires 1 request per second
      await new Promise((resolve) => setTimeout(resolve, 1100));
    } catch (error) {
      logger.warn(
        `Geocode attempt failed for query "${query}": ${error.message}`,
      );
    }
  }

  logger.warn(
    `Unable to determine coordinates for "${location}" after trying all variations`,
  );
  return null;
}

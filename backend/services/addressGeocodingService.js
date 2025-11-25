import fetch from "node-fetch";
import config from "../config/index.js";
import { logger } from "../utils/appLogger.js";

const NOMINATIM_BASE_URL = "https://nominatim.openstreetmap.org/search";
const DEFAULT_REGION = config.geocode.defaultRegion;
const USER_AGENT = "DisasterResponseOptimizer/1.0";

// Known fallback coordinates for Pune localities when external geocoding fails
const FALLBACK_LOCATIONS = [
  {
    keywords: ["shaniwar wada"],
    label: "Shaniwar Wada, Pune",
    lat: 18.5193825,
    lon: 73.8553566,
  },
  {
    keywords: ["fergusson college road", "fc road", "deccan"],
    label: "Fergusson College Road, Pune",
    lat: 18.5241485,
    lon: 73.8385915,
  },
  {
    keywords: ["jangali maharaj road", "jm road"],
    label: "Jangali Maharaj Road, Pune",
    lat: 18.5270553,
    lon: 73.8526085,
  },
  {
    keywords: ["dagdusheth"],
    label: "Dagdusheth Halwai Ganpati Temple, Pune",
    lat: 18.5167264,
    lon: 73.8562556,
  },
  {
    keywords: ["koregaon park"],
    label: "Koregaon Park, Pune",
    lat: 18.5366225,
    lon: 73.8932738,
  },
  {
    keywords: ["shivaji nagar", "shivajinagar"],
    label: "Shivaji Nagar, Pune",
    lat: 18.532172,
    lon: 73.8496602,
  },
  {
    keywords: ["swargate"],
    label: "Swargate Bus Stand, Pune",
    lat: 18.5002039,
    lon: 73.8636453,
  },
  {
    keywords: ["pune railway station"],
    label: "Pune Railway Station",
    lat: 18.5287091,
    lon: 73.8740016,
  },
  {
    keywords: ["sassoon hospital"],
    label: "Sassoon General Hospital, Pune",
    lat: 18.5251434,
    lon: 73.8695664,
  },
  {
    keywords: ["mg road", "mahatma gandhi road"],
    label: "Mahatma Gandhi Road, Pune Camp",
    lat: 18.5153584,
    lon: 73.8796889,
  },
  {
    keywords: ["pune central", "central pune", "pune city center"],
    label: "Pune City Center",
    lat: 18.5204,
    lon: 73.8567,
  },
];

function findFallbackCoordinates(location) {
  if (!location) {
    return null;
  }

  const normalized = location.toLowerCase();
  for (const entry of FALLBACK_LOCATIONS) {
    const match = entry.keywords.some((keyword) =>
      normalized.includes(keyword)
    );

    if (match) {
      logger.info(`Using fallback coordinates for "${location}"`);
      return {
        lat: entry.lat,
        lon: entry.lon,
        formattedAddress: entry.label,
      };
    }
  }

  return null;
}

/**
 * Geocode a human readable location into latitude/longitude using OSM Nominatim.
 * @param {string} location - Human readable location string
 * @returns {Promise<{lat:number, lon:number, formattedAddress:string} | null>}
 */
export async function geocodeLocation(location) {
  if (!location) {
    logger.debug("No location provided for geocoding");
    return null;
  }

  const query = DEFAULT_REGION ? `${location}, ${DEFAULT_REGION}` : location;
  const url = new URL(NOMINATIM_BASE_URL);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");

  try {
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
      const result = data[0];
      logger.info(`Geocoded "${location}" → (${result.lat}, ${result.lon})`);

      return {
        lat: Number(result.lat),
        lon: Number(result.lon),
        formattedAddress: result.display_name,
      };
    }

    logger.warn(`No geocode results for: "${query}"`);
  } catch (error) {
    logger.error("Error geocoding location:", error.message);
  }

  const fallback = findFallbackCoordinates(location);
  if (fallback) {
    return fallback;
  }

  logger.warn(`Unable to determine coordinates for "${location}"`);
  return null;
}

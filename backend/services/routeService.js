import axios from "axios";
import { logger } from "../utils/appLogger.js";

// OSRM API Configuration
const OSRM_BASE_URL = "https://router.project-osrm.org";
const OSRM_TIMEOUT = 10000; // 10 seconds timeout

// Simple in-memory cache for routes
const routeCache = new Map();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes
const MAX_CACHE_SIZE = 500;

/**
 * Generate a cache key for route coordinates
 */
function getCacheKey(coordinates) {
  return coordinates
    .map(([lat, lon]) => `${lat.toFixed(5)},${lon.toFixed(5)}`)
    .join(";");
}

/**
 * Clean expired cache entries
 */
function cleanCache() {
  const now = Date.now();
  for (const [key, value] of routeCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      routeCache.delete(key);
    }
  }
  // Limit cache size
  if (routeCache.size > MAX_CACHE_SIZE) {
    const keysToDelete = Array.from(routeCache.keys()).slice(
      0,
      routeCache.size - MAX_CACHE_SIZE,
    );
    keysToDelete.forEach((key) => routeCache.delete(key));
  }
}

/**
 * Get road-snapped route between waypoints using OSRM
 *
 * @param {Array} waypoints - Array of {lat, lon} objects
 * @param {Object} options - Optional configuration
 * @param {string} options.profile - OSRM profile: 'driving', 'walking', 'cycling'
 * @param {boolean} options.alternatives - Whether to return alternative routes
 * @param {boolean} options.steps - Whether to return turn-by-turn instructions
 * @returns {Promise<Object>} Route data with geometry, distance, duration
 */
export async function getRoute(waypoints, options = {}) {
  const { profile = "driving", alternatives = false, steps = false } = options;

  if (!waypoints || waypoints.length < 2) {
    throw new Error("At least 2 waypoints are required");
  }

  // Normalize waypoints format
  const coordinates = waypoints.map((wp) => {
    const lat = wp.lat ?? wp[0];
    const lon = wp.lon ?? wp.lng ?? wp[1];
    return [lat, lon];
  });

  // Check cache first
  const cacheKey = `${profile}:${getCacheKey(coordinates)}`;
  const cached = routeCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    logger.debug(`[RouteService] Cache hit for route`);
    return cached.data;
  }

  // Build OSRM URL (OSRM expects lon,lat format)
  const coordsStr = coordinates.map(([lat, lon]) => `${lon},${lat}`).join(";");
  const url = `${OSRM_BASE_URL}/route/v1/${profile}/${coordsStr}`;

  const params = {
    overview: "full",
    geometries: "geojson",
    alternatives: alternatives,
    steps: steps,
  };

  try {
    logger.debug(
      `[RouteService] Fetching route from OSRM: ${coordinates.length} waypoints`,
    );

    const response = await axios.get(url, {
      params,
      timeout: OSRM_TIMEOUT,
    });

    if (response.data.code !== "Ok" || !response.data.routes?.length) {
      throw new Error(`OSRM error: ${response.data.code || "No routes found"}`);
    }

    const osrmRoute = response.data.routes[0];

    // Convert OSRM geometry (lon,lat) to our format (lat,lon)
    const routeGeometry = osrmRoute.geometry.coordinates.map(([lon, lat]) => ({
      lat,
      lon,
    }));

    const routeData = {
      geometry: routeGeometry,
      distance: osrmRoute.distance, // in meters
      duration: osrmRoute.duration, // in seconds
      waypoints: response.data.waypoints?.map((wp) => ({
        lat: wp.location[1],
        lon: wp.location[0],
        name: wp.name || null,
      })),
      steps: steps ? osrmRoute.legs?.flatMap((leg) => leg.steps || []) : null,
    };

    // Cache the result
    routeCache.set(cacheKey, {
      data: routeData,
      timestamp: Date.now(),
    });

    // Clean cache periodically
    if (routeCache.size > MAX_CACHE_SIZE * 0.9) {
      cleanCache();
    }

    return routeData;
  } catch (error) {
    if (error.code === "ECONNABORTED") {
      logger.warn("[RouteService] OSRM request timed out");
    } else if (error.response?.status === 429) {
      logger.warn("[RouteService] OSRM rate limited");
    } else {
      logger.error(`[RouteService] OSRM error: ${error.message}`);
    }

    // Return fallback straight-line route
    return getFallbackRoute(coordinates);
  }
}

/**
 * Generate a fallback straight-line route when OSRM fails
 */
function getFallbackRoute(coordinates) {
  // Calculate straight-line distance using Haversine
  let totalDistance = 0;
  for (let i = 0; i < coordinates.length - 1; i++) {
    totalDistance += haversine(
      coordinates[i][0],
      coordinates[i][1],
      coordinates[i + 1][0],
      coordinates[i + 1][1],
    );
  }

  return {
    geometry: coordinates.map(([lat, lon]) => ({ lat, lon })),
    distance: totalDistance,
    duration: totalDistance / 13.89, // Assume ~50 km/h average speed
    waypoints: coordinates.map(([lat, lon]) => ({ lat, lon, name: null })),
    steps: null,
    isFallback: true,
  };
}

/**
 * Haversine formula to calculate distance between two points
 */
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth's radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Get route for volunteer navigation to a task
 *
 * @param {Object} origin - Starting point {lat, lon}
 * @param {Object} destination - Destination point {lat, lon}
 * @returns {Promise<Object>} Route data
 */
export async function getVolunteerRoute(origin, destination) {
  return getRoute([origin, destination], {
    profile: "driving",
    steps: true, // Include turn-by-turn for volunteer navigation
  });
}

/**
 * Get optimized route for multiple stops (for missions)
 * Uses OSRM's trip service for TSP optimization
 *
 * @param {Array} waypoints - Array of {lat, lon} objects
 * @param {Object} options - Optional configuration
 * @returns {Promise<Object>} Optimized route data
 */
export async function getOptimizedRoute(waypoints, options = {}) {
  const { roundtrip = true, source = "first" } = options;

  if (!waypoints || waypoints.length < 2) {
    throw new Error("At least 2 waypoints are required");
  }

  // Build OSRM trip URL for TSP optimization
  const coordsStr = waypoints
    .map((wp) => `${wp.lon ?? wp.lng},${wp.lat}`)
    .join(";");
  const url = `${OSRM_BASE_URL}/trip/v1/driving/${coordsStr}`;

  const params = {
    overview: "full",
    geometries: "geojson",
    roundtrip: roundtrip,
    source: source,
  };

  try {
    const response = await axios.get(url, {
      params,
      timeout: OSRM_TIMEOUT,
    });

    if (response.data.code !== "Ok" || !response.data.trips?.length) {
      // Fall back to regular route if trip optimization fails
      logger.warn("[RouteService] OSRM trip failed, using regular route");
      return getRoute(waypoints);
    }

    const trip = response.data.trips[0];

    return {
      geometry: trip.geometry.coordinates.map(([lon, lat]) => ({ lat, lon })),
      distance: trip.distance,
      duration: trip.duration,
      waypoints: response.data.waypoints?.map((wp) => ({
        lat: wp.location[1],
        lon: wp.location[0],
        waypointIndex: wp.waypoint_index,
        tripIndex: wp.trips_index,
      })),
      optimizedOrder: response.data.waypoints?.map((wp) => wp.waypoint_index),
    };
  } catch (error) {
    logger.error(`[RouteService] OSRM trip error: ${error.message}`);
    // Fall back to regular route
    return getRoute(waypoints);
  }
}

import mongoose from "mongoose";
import axios from "axios";
import { logger } from "../utils/appLogger.js";

// OSRM API Configuration
const OSRM_BASE_URL = "https://router.project-osrm.org";
const OSRM_TIMEOUT = 10000;

// Reroute radius in meters
const AFFECTED_RADIUS_METERS = 100;

/**
 * Haversine formula to calculate distance between two points in meters.
 */
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000;
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
 * Check if a point falls within a given radius of any point on a route.
 *
 * @param {{ lat: number, lng: number }} point - The road condition location
 * @param {Array} routeGeometry - Array of [lat, lon] coordinate pairs
 * @param {number} radiusMeters - Radius to check (default 100m)
 * @returns {boolean}
 */
function isPointNearRoute(point, routeGeometry, radiusMeters = AFFECTED_RADIUS_METERS) {
  if (!routeGeometry || routeGeometry.length === 0) return false;

  for (const coord of routeGeometry) {
    // Route geometry from logistics agent is [[lat, lon], ...] format
    const routeLat = Array.isArray(coord) ? coord[0] : coord.lat;
    const routeLon = Array.isArray(coord) ? coord[1] : coord.lon ?? coord.lng;

    if (routeLat == null || routeLon == null) continue;

    const distance = haversine(point.lat, point.lng, routeLat, routeLon);
    if (distance <= radiusMeters) {
      return true;
    }
  }

  return false;
}

/**
 * Move a geographic point by a distance in meters along a bearing (degrees).
 * Returns [lat, lon].
 */
function movePoint(lat, lon, distanceMeters, bearingDeg) {
  const R = 6371000;
  const d = distanceMeters / R;
  const brng = (bearingDeg * Math.PI) / 180;
  const lat1 = (lat * Math.PI) / 180;
  const lon1 = (lon * Math.PI) / 180;

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brng)
  );
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(brng) * Math.sin(d) * Math.cos(lat1),
      Math.cos(d) - Math.sin(lat1) * Math.sin(lat2)
    );

  return [(lat2 * 180) / Math.PI, (lon2 * 180) / Math.PI];
}

/**
 * Compute the bearing (degrees) from point A to point B.
 */
function bearing(lat1, lon1, lat2, lon2) {
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const dLambda = ((lon2 - lon1) * Math.PI) / 180;

  const y = Math.sin(dLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLambda);

  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/**
 * Parse an OSRM response into an array of route objects sorted by duration.
 */
function parseOsrmRoutes(responseData) {
  if (responseData.code !== "Ok" || !responseData.routes?.length) return [];

  return responseData.routes
    .map((osrmRoute) => ({
      geometry: osrmRoute.geometry.coordinates.map(([lon, lat]) => [lat, lon]),
      distance: osrmRoute.distance,
      duration: osrmRoute.duration,
    }))
    .sort((a, b) => a.duration - b.duration);
}

/**
 * Request a route from OSRM for the given [lat, lon] waypoints.
 * Returns the parsed routes array or [].
 */
async function fetchOsrmRoutes(waypoints, alternatives = false) {
  const coordsStr = waypoints.map(([lat, lon]) => `${lon},${lat}`).join(";");
  const url = `${OSRM_BASE_URL}/route/v1/driving/${coordsStr}`;

  const params = {
    overview: "full",
    geometries: "geojson",
    alternatives,
  };

  const response = await axios.get(url, { params, timeout: OSRM_TIMEOUT });
  return parseOsrmRoutes(response.data);
}

/**
 * Fetch alternative routes from OSRM that truly avoid the blocked area.
 *
 * Strategy:
 * 1. Ask OSRM for alternatives on the direct origin→destination path.
 *    If any alternative avoids the blocked area, use it.
 * 2. If all direct alternatives still pass through, compute detour waypoints
 *    perpendicular to the route direction at the blocked point (both sides),
 *    and request routes through each detour waypoint. Pick the fastest safe one.
 *
 * @param {Array} origin - [lat, lon] of route start
 * @param {Array} destination - [lat, lon] of route end
 * @param {{ lat: number, lng: number }} blockedPoint - Road condition location to avoid
 * @param {number} radiusMeters - Radius around blocked point to avoid
 * @param {Array} originalRouteGeometry - The original route geometry for direction calculation
 * @returns {Object|null} New route data or null if no safe alternative found
 */
async function getAlternativeRoute(
  origin,
  destination,
  blockedPoint,
  radiusMeters = AFFECTED_RADIUS_METERS,
  originalRouteGeometry = []
) {
  try {
    // ── Step 1: Try OSRM alternatives on the direct path ──
    const directRoutes = await fetchOsrmRoutes([origin, destination], true);

    // Find the fastest route that does NOT pass near the blocked point
    for (const route of directRoutes) {
      if (!isPointNearRoute(blockedPoint, route.geometry, radiusMeters)) {
        logger.info(
          `[RerouteService] Found safe OSRM alternative (${(route.distance / 1000).toFixed(1)} km, ${(route.duration / 60).toFixed(1)} min)`
        );
        return route;
      }
    }

    // ── Step 2: Generate detour waypoints perpendicular to the route ──
    logger.info("[RerouteService] All direct alternatives pass through blocked area, attempting waypoint-based detour");

    // Find the route direction at the blocked point so we can go perpendicular
    let routeBearing = bearing(origin[0], origin[1], destination[0], destination[1]);

    // Use the original route geometry if available to get a better local bearing
    if (originalRouteGeometry.length >= 2) {
      let nearestIdx = 0;
      let nearestDist = Infinity;
      for (let i = 0; i < originalRouteGeometry.length; i++) {
        const c = originalRouteGeometry[i];
        const lat = Array.isArray(c) ? c[0] : c.lat;
        const lon = Array.isArray(c) ? c[1] : c.lon ?? c.lng;
        const d = haversine(blockedPoint.lat, blockedPoint.lng, lat, lon);
        if (d < nearestDist) {
          nearestDist = d;
          nearestIdx = i;
        }
      }
      // Use the segment around the nearest point for a local bearing
      const prevIdx = Math.max(0, nearestIdx - 1);
      const nextIdx = Math.min(originalRouteGeometry.length - 1, nearestIdx + 1);
      const prevC = originalRouteGeometry[prevIdx];
      const nextC = originalRouteGeometry[nextIdx];
      const pLat = Array.isArray(prevC) ? prevC[0] : prevC.lat;
      const pLon = Array.isArray(prevC) ? prevC[1] : prevC.lon ?? prevC.lng;
      const nLat = Array.isArray(nextC) ? nextC[0] : nextC.lat;
      const nLon = Array.isArray(nextC) ? nextC[1] : nextC.lon ?? nextC.lng;
      routeBearing = bearing(pLat, pLon, nLat, nLon);
    }

    // Perpendicular bearings (90° left and right of route direction)
    const perpLeft = (routeBearing + 90) % 360;
    const perpRight = (routeBearing + 270) % 360;

    // Offset distance: enough to push the route well clear of the blocked zone
    // Use 500m to give the road network room for a real detour
    const detourOffsetMeters = 500;

    const detourLeft = movePoint(blockedPoint.lat, blockedPoint.lng, detourOffsetMeters, perpLeft);
    const detourRight = movePoint(blockedPoint.lat, blockedPoint.lng, detourOffsetMeters, perpRight);

    // Try both detour sides and collect safe routes
    const candidates = [];

    for (const detourWP of [detourLeft, detourRight]) {
      try {
        const detourRoutes = await fetchOsrmRoutes(
          [origin, detourWP, destination],
          false
        );
        for (const route of detourRoutes) {
          if (!isPointNearRoute(blockedPoint, route.geometry, radiusMeters)) {
            candidates.push(route);
          }
        }
      } catch (err) {
        logger.debug(`[RerouteService] Detour waypoint attempt failed: ${err.message}`);
      }
    }

    if (candidates.length > 0) {
      // Pick the fastest safe candidate
      candidates.sort((a, b) => a.duration - b.duration);
      const best = candidates[0];
      logger.info(
        `[RerouteService] Found safe detour route (${(best.distance / 1000).toFixed(1)} km, ${(best.duration / 60).toFixed(1)} min)`
      );
      return best;
    }

    // ── Step 3: Larger detour as last resort (1km offset) ──
    logger.info("[RerouteService] 500m detour insufficient, trying 1km offset");
    const largeOffset = 1000;

    for (const bearingDir of [perpLeft, perpRight]) {
      const farDetour = movePoint(blockedPoint.lat, blockedPoint.lng, largeOffset, bearingDir);
      try {
        const farRoutes = await fetchOsrmRoutes(
          [origin, farDetour, destination],
          false
        );
        for (const route of farRoutes) {
          if (!isPointNearRoute(blockedPoint, route.geometry, radiusMeters)) {
            logger.info(
              `[RerouteService] Found safe far-detour route (${(route.distance / 1000).toFixed(1)} km, ${(route.duration / 60).toFixed(1)} min)`
            );
            return route;
          }
        }
      } catch (err) {
        logger.debug(`[RerouteService] Far detour attempt failed: ${err.message}`);
      }
    }

    logger.warn("[RerouteService] Could not find any route that avoids the blocked area");
    return null;
  } catch (error) {
    logger.error(`[RerouteService] Failed to get alternative route: ${error.message}`);
    return null;
  }
}

/**
 * Check all active missions for routes affected by a new road condition,
 * and automatically reroute them to the next fastest available route.
 *
 * @param {{ lat: number, lng: number }} roadConditionPoint - Location of the new road condition
 * @param {string} conditionId - Road condition ID for logging
 * @returns {{ affected: number, rerouted: number, failed: number }} Summary of rerouting results
 */
export async function checkAndRerouteAffectedMissions(roadConditionPoint, conditionId) {
  const db = mongoose.connection.db;
  const missionsCollection = db.collection("missions");

  const summary = { affected: 0, rerouted: 0, failed: 0 };

  try {
    // 1. Fetch all active missions
    const activeMissions = await missionsCollection
      .find({ status: "Active" })
      .toArray();

    if (activeMissions.length === 0) {
      logger.debug("[RerouteService] No active missions to check");
      return summary;
    }

    logger.info(
      `[RerouteService] Checking ${activeMissions.length} active mission(s) against road condition ${conditionId}`
    );

    // 2. For each mission, check each route
    for (const mission of activeMissions) {
      const routes = mission.routes || [];
      let missionAffected = false;
      const updatedRoutes = [];

      for (const routeObj of routes) {
        const routeGeometry = routeObj.route || routeObj.geometry || [];

        if (!routeGeometry.length) {
          updatedRoutes.push(routeObj);
          continue;
        }

        // Check if this route passes near the road condition
        const isAffected = isPointNearRoute(roadConditionPoint, routeGeometry, AFFECTED_RADIUS_METERS);

        if (!isAffected) {
          updatedRoutes.push(routeObj);
          continue;
        }

        // Route is affected — attempt reroute
        missionAffected = true;
        summary.affected++;

        // Extract origin and destination from the existing route geometry
        const firstPoint = routeGeometry[0];
        const lastPoint = routeGeometry[routeGeometry.length - 1];

        const origin = Array.isArray(firstPoint)
          ? firstPoint
          : [firstPoint.lat, firstPoint.lon ?? firstPoint.lng];
        const destination = Array.isArray(lastPoint)
          ? lastPoint
          : [lastPoint.lat, lastPoint.lon ?? lastPoint.lng];

        logger.info(
          `[RerouteService] Route in mission ${mission._id} is affected by road condition ${conditionId}. Rerouting...`
        );

        const alternativeRoute = await getAlternativeRoute(
          origin,
          destination,
          roadConditionPoint,
          AFFECTED_RADIUS_METERS,
          routeGeometry
        );

        if (alternativeRoute) {
          // Replace route geometry with the new alternative
          updatedRoutes.push({
            ...routeObj,
            route: alternativeRoute.geometry,
            total_distance: alternativeRoute.distance,
            duration: alternativeRoute.duration,
            is_road_snapped: true,
            rerouted: true,
            rerouted_reason: `Road condition ${conditionId}`,
            rerouted_at: new Date().toISOString(),
            original_distance: routeObj.total_distance,
            original_duration: routeObj.duration,
          });
          summary.rerouted++;
          logger.info(
            `[RerouteService] ✅ Mission ${mission._id} rerouted successfully`
          );
        } else {
          // Could not find alternative, keep original but mark as affected
          updatedRoutes.push({
            ...routeObj,
            road_condition_warning: conditionId,
            road_condition_warning_at: new Date().toISOString(),
          });
          summary.failed++;
          logger.warn(
            `[RerouteService] ⚠️ Could not find alternative route for mission ${mission._id}`
          );
        }
      }

      // 3. Update mission with new routes if affected
      if (missionAffected) {
        await missionsCollection.updateOne(
          { _id: mission._id },
          {
            $set: {
              routes: updatedRoutes,
              lastReroutedAt: new Date().toISOString(),
              lastReroutedReason: `Road condition ${conditionId}`,
            },
          }
        );
      }
    }

    logger.info(
      `[RerouteService] Reroute summary for ${conditionId}: ${summary.affected} affected, ${summary.rerouted} rerouted, ${summary.failed} failed`
    );

    return summary;
  } catch (error) {
    logger.error(`[RerouteService] Error during reroute check: ${error.message}`);
    return summary;
  }
}

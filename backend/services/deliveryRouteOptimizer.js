import { getDistance } from "geolib";
import salesman from "salesman.js";
import { logger } from "../utils/appLogger.js";

/**
 * Solves the Traveling Salesman Problem (TSP) using simulated annealing.
 * @param {Array<{lat: number, lon: number}>} locations - Array of location objects with depot at index 0
 * @returns {Array<{lat: number, lon: number}>} - Optimized route including return to depot
 */
export function solveTSP(locations) {
  // Create the list of points for the salesman.js library
  const points = locations.map((loc) => ({ x: loc.lat, y: loc.lon }));

  // Define the distance function using geolib
  const distanceFunction = (p1, p2) => {
    return getDistance(
      { latitude: p1.x, longitude: p1.y },
      { latitude: p2.x, longitude: p2.y }
    );
  };

  // Solve the TSP using Simulated Annealing algorithm
  logger.debug("Solving optimization problem with salesman.js...");
  const solution = salesman.solve(points, distanceFunction);
  logger.debug("Optimization solution found!");

  // Map the solution indices back to original location objects
  const orderedRoute = solution.map((index) => locations[index]);

  // Add the depot at the end to complete the loop
  orderedRoute.push(locations[0]);

  return orderedRoute;
}

/**
 * Optimizes a delivery route from a depot to multiple stops.
 * @param {Object} params - Route optimization parameters
 * @param {{lat: number, lon: number}} params.depot - Starting/ending depot location
 * @param {Array<{lat: number, lon: number}>} params.stops - Array of stop locations
 * @returns {Array<{lat: number, lon: number}>} - Optimized route
 * @throws {Error} - If solver fails to find a solution
 */
export function optimizeRoute({ depot, stops }) {
  if (!depot || !stops) {
    throw new Error("Missing depot or stops");
  }

  logger.info(
    `Optimizing route from depot (${depot.lat}, ${depot.lon}) with ${stops.length} stops`
  );

  // Combine depot and stops (Depot must be index 0)
  const allLocations = [depot, ...stops];

  // Call the TSP solver
  const orderedRoute = solveTSP(allLocations);

  if (!orderedRoute) {
    throw new Error("AI solver could not find a solution.");
  }

  return orderedRoute;
}

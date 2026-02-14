/**
 * Resource Station Controller
 * Handles CRUD and inventory management for resource stations
 */

import ResourceStation from "../models/ResourceStationModel.js";
import { sendSuccess, sendError } from "../utils/apiResponse.js";
import { HTTP_STATUS } from "../constants/index.js";

/**
 * GET /api/resources/stations
 * Get all resource stations with their current inventory
 */
export async function getAllStations(req, res) {
  try {
    const { type, status, stationId } = req.query;

    const query = {};
    if (type) query.type = type;
    if (status) query.status = status;
    if (stationId) query.stationId = stationId;

    const stations = await ResourceStation.find(query).sort({ name: 1 });

    // Transform to the shape the frontend expects
    const result = stations.map((station) => {
      const s = station.toObject();
      return {
        id: s._id,
        stationId: s.stationId,
        name: s.name,
        type: s.type,
        status: s.status,
        lat: s.location?.lat,
        lon: s.location?.lng,
        location: s.location,
        vehicles: s.vehicles,
        fleet: s.fleet,
        personnel: s.personnel,
        staff: s.staff,
        supplies: s.supplies,
        lastRestocked: s.lastRestocked,
        contact: s.contact,
        vehicleAvailabilityPercent: s.vehicleAvailabilityPercent,
        lowStockSupplies: s.lowStockSupplies,
      };
    });

    sendSuccess(res, result);
  } catch (error) {
    console.error("Error fetching resource stations:", error);
    sendError(
      res,
      "Failed to fetch resource stations",
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
    );
  }
}

/**
 * GET /api/resources/stations/:id
 * Get a single resource station by ID
 */
export async function getStation(req, res) {
  try {
    const station = await ResourceStation.findById(req.params.id);
    if (!station) {
      return sendError(res, "Station not found", HTTP_STATUS.NOT_FOUND);
    }
    sendSuccess(res, station);
  } catch (error) {
    console.error("Error fetching resource station:", error);
    sendError(
      res,
      "Failed to fetch station",
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
    );
  }
}

/**
 * POST /api/resources/stations
 * Create a new resource station
 */
export async function createStation(req, res) {
  try {
    const { stationId, name, type, location, fleet, staff, supplies, contact } =
      req.body;

    if (!stationId || !name || !type || !location?.lat || !location?.lng) {
      return sendError(
        res,
        "stationId, name, type, and location (lat/lng) are required",
        HTTP_STATUS.BAD_REQUEST,
      );
    }

    // Check for duplicate stationId
    const existing = await ResourceStation.findOne({ stationId });
    if (existing) {
      return sendError(
        res,
        `Station with ID "${stationId}" already exists`,
        HTTP_STATUS.BAD_REQUEST,
      );
    }

    const station = new ResourceStation({
      stationId,
      name,
      type,
      location,
      fleet: fleet || [],
      staff: staff || [],
      supplies: supplies || {},
      contact: contact || {},
      lastRestocked: new Date(),
    });

    await station.save();
    sendSuccess(res, station, "Station created", HTTP_STATUS.CREATED);
  } catch (error) {
    console.error("Error creating resource station:", error);
    sendError(
      res,
      "Failed to create station",
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
    );
  }
}

/**
 * PATCH /api/resources/stations/:id
 * Update resource station (inventory, fleet, personnel, etc.)
 * Supports partial updates for supply quantities
 */
export async function updateStation(req, res) {
  try {
    const station = await ResourceStation.findById(req.params.id);
    if (!station) {
      return sendError(res, "Station not found", HTTP_STATUS.NOT_FOUND);
    }

    const updates = req.body;

    // Handle direct supply updates (e.g., { water: 150 })
    // This is what ResourceInventory.jsx sends
    const supplyTypes = ["water", "medical", "blankets", "food"];
    const isSupplyUpdate = Object.keys(updates).some((key) =>
      supplyTypes.includes(key),
    );

    if (isSupplyUpdate) {
      for (const [key, value] of Object.entries(updates)) {
        if (supplyTypes.includes(key) && typeof value === "number") {
          station.supplies[key].current = value;
        }
      }
      station.lastRestocked = new Date();
      await station.save();
      return sendSuccess(res, station, "Supplies updated");
    }

    // Handle full/partial updates
    if (updates.name) station.name = updates.name;
    if (updates.type) station.type = updates.type;
    if (updates.status) station.status = updates.status;
    if (updates.location) station.location = updates.location;
    if (updates.contact) station.contact = updates.contact;

    if (updates.fleet) station.fleet = updates.fleet;
    if (updates.staff) station.staff = updates.staff;

    if (updates.vehicles) {
      Object.assign(station.vehicles, updates.vehicles);
    }
    if (updates.personnel) {
      Object.assign(station.personnel, updates.personnel);
    }
    if (updates.supplies) {
      for (const [key, value] of Object.entries(updates.supplies)) {
        if (station.supplies[key]) {
          Object.assign(station.supplies[key], value);
        }
      }
      station.lastRestocked = new Date();
    }

    await station.save();
    sendSuccess(res, station, "Station updated");
  } catch (error) {
    console.error("Error updating resource station:", error);
    sendError(
      res,
      "Failed to update station",
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
    );
  }
}

/**
 * DELETE /api/resources/stations/:id
 * Delete a resource station
 */
export async function deleteStation(req, res) {
  try {
    const station = await ResourceStation.findByIdAndDelete(req.params.id);
    if (!station) {
      return sendError(res, "Station not found", HTTP_STATUS.NOT_FOUND);
    }
    sendSuccess(res, null, "Station deleted");
  } catch (error) {
    console.error("Error deleting resource station:", error);
    sendError(
      res,
      "Failed to delete station",
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
    );
  }
}

/**
 * GET /api/resources/summary
 * Aggregate summary across all active stations
 */
export async function getResourceSummary(req, res) {
  try {
    const stations = await ResourceStation.find({ status: "active" });

    const summary = {
      totalStations: stations.length,
      vehicles: { total: 0, available: 0, deployed: 0 },
      personnel: { total: 0, available: 0, deployed: 0 },
      supplies: {
        water: { current: 0, minimum: 0, maximum: 0 },
        medical: { current: 0, minimum: 0, maximum: 0 },
        blankets: { current: 0, minimum: 0, maximum: 0 },
        food: { current: 0, minimum: 0, maximum: 0 },
      },
      lowStockAlerts: [],
      fleetBreakdown: {},
      staffBreakdown: {},
    };

    for (const station of stations) {
      // Vehicles
      summary.vehicles.total += station.vehicles.total;
      summary.vehicles.available += station.vehicles.available;
      summary.vehicles.deployed += station.vehicles.deployed;

      // Personnel
      summary.personnel.total += station.personnel.total;
      summary.personnel.available += station.personnel.available;
      summary.personnel.deployed += station.personnel.deployed;

      // Supplies
      for (const type of ["water", "medical", "blankets", "food"]) {
        const supply = station.supplies[type];
        if (supply) {
          summary.supplies[type].current += supply.current || 0;
          summary.supplies[type].minimum += supply.minimum || 0;
          summary.supplies[type].maximum += supply.maximum || 0;
        }
      }

      // Fleet breakdown
      for (const f of station.fleet) {
        if (!summary.fleetBreakdown[f.type]) {
          summary.fleetBreakdown[f.type] = { total: 0, available: 0, inUse: 0 };
        }
        summary.fleetBreakdown[f.type].total += f.total;
        summary.fleetBreakdown[f.type].available += f.available;
        summary.fleetBreakdown[f.type].inUse += f.inUse;
      }

      // Staff breakdown
      for (const s of station.staff) {
        if (!summary.staffBreakdown[s.role]) {
          summary.staffBreakdown[s.role] = {
            total: 0,
            available: 0,
            deployed: 0,
          };
        }
        summary.staffBreakdown[s.role].total += s.total;
        summary.staffBreakdown[s.role].available += s.available;
        summary.staffBreakdown[s.role].deployed += s.deployed;
      }

      // Low stock alerts
      const lowStocks = station.lowStockSupplies;
      if (lowStocks?.length > 0) {
        lowStocks.forEach((ls) =>
          summary.lowStockAlerts.push({
            stationId: station._id,
            stationName: station.name,
            ...ls,
          }),
        );
      }
    }

    sendSuccess(res, summary);
  } catch (error) {
    console.error("Error fetching resource summary:", error);
    sendError(
      res,
      "Failed to fetch summary",
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
    );
  }
}

/**
 * PATCH /api/resources/stations/:id/deploy
 * Deploy vehicles/personnel from a station
 */
export async function deployResources(req, res) {
  try {
    const station = await ResourceStation.findById(req.params.id);
    if (!station) {
      return sendError(res, "Station not found", HTTP_STATUS.NOT_FOUND);
    }

    const { vehicleType, vehicleCount, role, personnelCount } = req.body;

    // Deploy vehicles
    if (vehicleType && vehicleCount) {
      const fleetItem = station.fleet.find((f) => f.type === vehicleType);
      if (!fleetItem) {
        return sendError(
          res,
          `Vehicle type "${vehicleType}" not found`,
          HTTP_STATUS.BAD_REQUEST,
        );
      }
      if (fleetItem.available < vehicleCount) {
        return sendError(
          res,
          `Only ${fleetItem.available} ${vehicleType}(s) available`,
          HTTP_STATUS.BAD_REQUEST,
        );
      }
      fleetItem.available -= vehicleCount;
      fleetItem.inUse += vehicleCount;
    }

    // Deploy personnel
    if (role && personnelCount) {
      const staffItem = station.staff.find((s) => s.role === role);
      if (!staffItem) {
        return sendError(
          res,
          `Role "${role}" not found`,
          HTTP_STATUS.BAD_REQUEST,
        );
      }
      if (staffItem.available < personnelCount) {
        return sendError(
          res,
          `Only ${staffItem.available} ${role}(s) available`,
          HTTP_STATUS.BAD_REQUEST,
        );
      }
      staffItem.available -= personnelCount;
      staffItem.deployed += personnelCount;
    }

    await station.save();
    sendSuccess(res, station, "Resources deployed");
  } catch (error) {
    console.error("Error deploying resources:", error);
    sendError(
      res,
      "Failed to deploy resources",
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
    );
  }
}

/**
 * PATCH /api/resources/stations/:id/return
 * Return deployed vehicles/personnel to a station
 */
export async function returnResources(req, res) {
  try {
    const station = await ResourceStation.findById(req.params.id);
    if (!station) {
      return sendError(res, "Station not found", HTTP_STATUS.NOT_FOUND);
    }

    const { vehicleType, vehicleCount, role, personnelCount } = req.body;

    // Return vehicles
    if (vehicleType && vehicleCount) {
      const fleetItem = station.fleet.find((f) => f.type === vehicleType);
      if (fleetItem) {
        const returnCount = Math.min(vehicleCount, fleetItem.inUse);
        fleetItem.inUse -= returnCount;
        fleetItem.available += returnCount;
      }
    }

    // Return personnel
    if (role && personnelCount) {
      const staffItem = station.staff.find((s) => s.role === role);
      if (staffItem) {
        const returnCount = Math.min(personnelCount, staffItem.deployed);
        staffItem.deployed -= returnCount;
        staffItem.available += returnCount;
      }
    }

    await station.save();
    sendSuccess(res, station, "Resources returned");
  } catch (error) {
    console.error("Error returning resources:", error);
    sendError(
      res,
      "Failed to return resources",
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
    );
  }
}

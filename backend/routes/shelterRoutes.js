/**
 * Shelter Management Routes
 * API endpoints for evacuation center management
 */

import express from "express";
import { v4 as uuidv4 } from "uuid";
import Shelter from "../models/ShelterModel.js";
import { sendSuccess, sendError } from "../utils/apiResponse.js";
import { HTTP_STATUS } from "../constants/index.js";
import {
  requireAuth,
  requireManager,
  allowPublic,
} from "../middleware/authMiddleware.js";

const router = express.Router();

/**
 * GET /api/shelters/public
 * Get all open shelters (no auth required) - for public map view
 */
router.get("/shelters/public", allowPublic, async (req, res) => {
  try {
    const shelters = await Shelter.find({ status: { $in: ["open", "full"] } })
      .select(
        "shelterId name type location capacity.total capacity.current status facilities contact",
      )
      .sort({ "capacity.current": 1 });

    const sheltersWithStats = shelters.map((shelter) => {
      const s = shelter.toObject();
      s.occupancyPercentage = shelter.capacity.total
        ? Math.round((shelter.capacity.current / shelter.capacity.total) * 100)
        : 0;
      s.availableSpots = Math.max(
        0,
        shelter.capacity.total - shelter.capacity.current,
      );
      return s;
    });

    sendSuccess(res, sheltersWithStats);
  } catch (error) {
    console.error("Error fetching public shelters:", error);
    sendError(
      res,
      "Failed to fetch shelters",
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
    );
  }
});

/**
 * GET /api/shelters
 * Get all shelters
 */
router.get("/shelters", requireAuth, async (req, res) => {
  try {
    const { status, area, hasCapacity } = req.query;

    const query = {};
    if (status) {
      query.status = status;
    }
    if (area) {
      query["location.area"] = area;
    }
    if (hasCapacity === "true") {
      query.$expr = { $lt: ["$capacity.current", "$capacity.total"] };
    }

    const shelters = await Shelter.find(query).sort({ "capacity.current": 1 });

    // Add computed fields
    const sheltersWithStats = shelters.map((shelter) => {
      const s = shelter.toObject();
      s.occupancyPercentage = shelter.capacity.total
        ? Math.round((shelter.capacity.current / shelter.capacity.total) * 100)
        : 0;
      s.availableSpots = Math.max(
        0,
        shelter.capacity.total - shelter.capacity.current,
      );
      return s;
    });

    sendSuccess(res, sheltersWithStats);
  } catch (error) {
    console.error("Error fetching shelters:", error);
    sendError(
      res,
      "Failed to fetch shelters",
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
    );
  }
});

/**
 * GET /api/shelters/:id
 * Get a specific shelter
 */
router.get("/shelters/:id", requireAuth, async (req, res) => {
  try {
    const shelter = await Shelter.findOne({ shelterId: req.params.id });

    if (!shelter) {
      return sendError(res, "Shelter not found", HTTP_STATUS.NOT_FOUND);
    }

    const s = shelter.toObject();
    s.occupancyPercentage = shelter.capacity.total
      ? Math.round((shelter.capacity.current / shelter.capacity.total) * 100)
      : 0;
    s.availableSpots = Math.max(
      0,
      shelter.capacity.total - shelter.capacity.current,
    );

    sendSuccess(res, s);
  } catch (error) {
    console.error("Error fetching shelter:", error);
    sendError(
      res,
      "Failed to fetch shelter",
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
    );
  }
});

/**
 * POST /api/shelters
 * Create a new shelter
 */
router.post("/shelters", requireManager, async (req, res) => {
  try {
    const {
      name,
      type,
      location,
      contact,
      capacity,
      facilities,
      supplies,
      operatingHours,
      notes,
    } = req.body;

    if (!name || !location?.lat || !location?.lng || !capacity?.total) {
      return sendError(
        res,
        "Name, location, and capacity are required",
        HTTP_STATUS.BAD_REQUEST,
      );
    }

    const shelter = new Shelter({
      shelterId: `SH-${uuidv4().slice(0, 8).toUpperCase()}`,
      name,
      type: type || "other",
      location,
      contact: contact || {},
      capacity: {
        total: capacity.total,
        current: capacity.current || 0,
        families: capacity.families || 0,
        individuals: capacity.individuals || 0,
        children: capacity.children || 0,
        elderly: capacity.elderly || 0,
        specialNeeds: capacity.specialNeeds || 0,
      },
      facilities: facilities || {},
      supplies: supplies || {},
      operatingHours: operatingHours || { is24Hours: true },
      notes,
    });

    await shelter.save();
    sendSuccess(res, shelter, "Shelter created successfully");
  } catch (error) {
    console.error("Error creating shelter:", error);
    sendError(
      res,
      "Failed to create shelter",
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
    );
  }
});

/**
 * PATCH /api/shelters/:id
 * Update shelter details (general update)
 */
router.patch("/shelters/:id", requireManager, async (req, res) => {
  try {
    const {
      name,
      location,
      contact,
      capacity,
      facilities,
      supplies,
      status,
      type,
      notes,
    } = req.body;

    const shelter = await Shelter.findById(req.params.id);
    if (!shelter) {
      return sendError(res, "Shelter not found", HTTP_STATUS.NOT_FOUND);
    }

    // Update fields if provided
    if (name) shelter.name = name;
    if (type) shelter.type = type;
    if (status) shelter.status = status;
    if (notes !== undefined) shelter.notes = notes;

    // Update location
    if (location) {
      shelter.location = {
        ...shelter.location,
        ...location,
      };
    }

    // Update contact
    if (contact) {
      shelter.contact = {
        ...shelter.contact,
        ...contact,
      };
    }

    // Update capacity (preserve current occupancy if not specified)
    if (capacity) {
      shelter.capacity = {
        ...shelter.capacity,
        ...capacity,
      };
    }

    // Update facilities
    if (facilities) {
      shelter.facilities = {
        ...shelter.facilities,
        ...facilities,
      };
    }

    // Update supplies
    if (supplies) {
      shelter.supplies = {
        ...shelter.supplies,
        ...supplies,
      };
    }

    shelter.updatedAt = new Date();

    // Auto-update status based on capacity changes
    if (shelter.capacity.current >= shelter.capacity.total) {
      shelter.status = "full";
    } else if (shelter.status === "full") {
      shelter.status = "open";
    }

    await shelter.save();

    // Return computed fields alongside saved data
    const result = shelter.toObject();
    result.occupancyPercentage = shelter.capacity.total
      ? Math.round((shelter.capacity.current / shelter.capacity.total) * 100)
      : 0;
    result.availableSpots = Math.max(
      0,
      shelter.capacity.total - shelter.capacity.current,
    );

    sendSuccess(res, result, "Shelter updated successfully");
  } catch (error) {
    console.error("Error updating shelter:", error);
    sendError(
      res,
      "Failed to update shelter",
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
    );
  }
});

/**
 * PATCH /api/shelters/:id/capacity
 * Update shelter capacity
 */
router.patch("/shelters/:id/capacity", requireAuth, async (req, res) => {
  try {
    const { current, families, individuals, children, elderly, specialNeeds } =
      req.body;

    const updateData = { updatedAt: new Date() };
    if (current !== undefined) updateData["capacity.current"] = current;
    if (families !== undefined) updateData["capacity.families"] = families;
    if (individuals !== undefined)
      updateData["capacity.individuals"] = individuals;
    if (children !== undefined) updateData["capacity.children"] = children;
    if (elderly !== undefined) updateData["capacity.elderly"] = elderly;
    if (specialNeeds !== undefined)
      updateData["capacity.specialNeeds"] = specialNeeds;

    const shelter = await Shelter.findOneAndUpdate(
      { shelterId: req.params.id },
      { $set: updateData },
      { new: true },
    );

    if (!shelter) {
      return sendError(res, "Shelter not found", HTTP_STATUS.NOT_FOUND);
    }

    // Update status if full
    if (shelter.capacity.current >= shelter.capacity.total) {
      shelter.status = "full";
      await shelter.save();
    } else if (shelter.status === "full") {
      shelter.status = "open";
      await shelter.save();
    }

    sendSuccess(res, shelter, "Capacity updated");
  } catch (error) {
    console.error("Error updating capacity:", error);
    sendError(
      res,
      "Failed to update capacity",
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
    );
  }
});

/**
 * PATCH /api/shelters/:id/supplies
 * Update shelter supplies
 */
router.patch("/shelters/:id/supplies", requireAuth, async (req, res) => {
  try {
    const updates = req.body;
    const updateData = { updatedAt: new Date() };

    for (const [key, value] of Object.entries(updates)) {
      if (
        [
          "water",
          "food",
          "blankets",
          "medicalKits",
          "hygiene",
          "diapers",
          "medicines",
        ].includes(key)
      ) {
        if (value.available !== undefined)
          updateData[`supplies.${key}.available`] = value.available;
        if (value.needed !== undefined)
          updateData[`supplies.${key}.needed`] = value.needed;
      }
    }

    const shelter = await Shelter.findOneAndUpdate(
      { shelterId: req.params.id },
      { $set: updateData },
      { new: true },
    );

    if (!shelter) {
      return sendError(res, "Shelter not found", HTTP_STATUS.NOT_FOUND);
    }

    sendSuccess(res, shelter, "Supplies updated");
  } catch (error) {
    console.error("Error updating supplies:", error);
    sendError(
      res,
      "Failed to update supplies",
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
    );
  }
});

/**
 * POST /api/shelters/:id/needs
 * Add urgent need to shelter
 */
router.post("/shelters/:id/needs", requireAuth, async (req, res) => {
  try {
    const { item, quantity, priority } = req.body;

    if (!item) {
      return sendError(res, "Item is required", HTTP_STATUS.BAD_REQUEST);
    }

    const shelter = await Shelter.findOneAndUpdate(
      { shelterId: req.params.id },
      {
        $push: {
          urgentNeeds: {
            item,
            quantity: quantity || 1,
            priority: priority || "medium",
            requestedAt: new Date(),
          },
        },
        $set: { updatedAt: new Date() },
      },
      { new: true },
    );

    if (!shelter) {
      return sendError(res, "Shelter not found", HTTP_STATUS.NOT_FOUND);
    }

    sendSuccess(res, shelter, "Urgent need added");
  } catch (error) {
    console.error("Error adding need:", error);
    sendError(
      res,
      "Failed to add urgent need",
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
    );
  }
});

/**
 * PATCH /api/shelters/:id/status
 * Update shelter status
 */
router.patch("/shelters/:id/status", requireManager, async (req, res) => {
  try {
    const { status, conditions } = req.body;

    const updateData = { updatedAt: new Date() };
    if (status) updateData.status = status;
    if (conditions) updateData.conditions = conditions;

    const shelter = await Shelter.findOneAndUpdate(
      { shelterId: req.params.id },
      { $set: updateData },
      { new: true },
    );

    if (!shelter) {
      return sendError(res, "Shelter not found", HTTP_STATUS.NOT_FOUND);
    }

    sendSuccess(res, shelter, "Shelter status updated");
  } catch (error) {
    console.error("Error updating status:", error);
    sendError(
      res,
      "Failed to update status",
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
    );
  }
});

/**
 * POST /api/shelters/:id/checkin
 * Record check-in at shelter
 */
router.patch("/shelters/:id/checkin", requireAuth, async (req, res) => {
  try {
    const { count = 1, type = "individual" } = req.body;

    const updateData = {
      updatedAt: new Date(),
      $inc: { "capacity.current": count },
    };

    if (type === "family") {
      updateData.$inc["capacity.families"] = 1;
    } else {
      updateData.$inc["capacity.individuals"] = count;
    }

    const shelter = await Shelter.findOneAndUpdate(
      { shelterId: req.params.id },
      updateData,
      { new: true },
    );

    if (!shelter) {
      return sendError(res, "Shelter not found", HTTP_STATUS.NOT_FOUND);
    }

    // Update status if full
    if (shelter.capacity.current >= shelter.capacity.total) {
      shelter.status = "full";
      await shelter.save();
    }

    sendSuccess(res, shelter, "Check-in recorded");
  } catch (error) {
    console.error("Error recording check-in:", error);
    sendError(
      res,
      "Failed to record check-in",
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
    );
  }
});

/**
 * GET /api/shelters/stats/summary
 * Get shelter statistics summary
 */
router.get("/shelters/stats/summary", requireAuth, async (req, res) => {
  try {
    const shelters = await Shelter.find({});

    const stats = {
      totalShelters: shelters.length,
      totalCapacity: 0,
      totalOccupied: 0,
      availableSpots: 0,
      sheltersByStatus: {},
      sheltersByCondition: {},
      criticalNeeds: [],
    };

    shelters.forEach((shelter) => {
      stats.totalCapacity += shelter.capacity.total || 0;
      stats.totalOccupied += shelter.capacity.current || 0;

      stats.sheltersByStatus[shelter.status] =
        (stats.sheltersByStatus[shelter.status] || 0) + 1;
      stats.sheltersByCondition[shelter.conditions] =
        (stats.sheltersByCondition[shelter.conditions] || 0) + 1;

      // Collect critical needs
      const criticalNeeds = shelter.urgentNeeds.filter(
        (n) => n.priority === "critical",
      );
      if (criticalNeeds.length > 0) {
        stats.criticalNeeds.push({
          shelterId: shelter.shelterId,
          shelterName: shelter.name,
          needs: criticalNeeds,
        });
      }
    });

    stats.availableSpots = stats.totalCapacity - stats.totalOccupied;
    stats.overallOccupancy =
      stats.totalCapacity > 0
        ? Math.round((stats.totalOccupied / stats.totalCapacity) * 100)
        : 0;

    sendSuccess(res, stats);
  } catch (error) {
    console.error("Error fetching stats:", error);
    sendError(
      res,
      "Failed to fetch statistics",
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
    );
  }
});

export default router;

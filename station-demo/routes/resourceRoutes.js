/**
 * Resource Management Routes for Station Demo
 * Proxies resource CRUD to the main backend platform
 * Station commanders use these to manage their station's fleet, staff, and supplies
 */

import express from "express";
import axios from "axios";

const router = express.Router();

// Helper: get main platform URL and auth header
function getPlatformConfig(req) {
  const stationConfig = req.app.get("stationConfig");
  const mainUrl = process.env.MAIN_PLATFORM_URL || "http://localhost:3000";
  return {
    mainUrl,
    stationId: stationConfig.stationId,
    stationType: stationConfig.type,
    stationName: stationConfig.name,
    stationLocation: stationConfig.location,
    headers: {
      "Content-Type": "application/json",
      "X-Auth-Pin": process.env.STATION_AUTH_PIN || "0000",
    },
  };
}

/**
 * GET /api/resources/my-station
 * Get this station's resource data from main platform
 * If not found, returns null (station hasn't registered resources yet)
 */
router.get("/resources/my-station", async (req, res) => {
  const { mainUrl, stationId, headers } = getPlatformConfig(req);

  try {
    const response = await axios.get(`${mainUrl}/api/resources/stations`, {
      headers,
      params: { stationId },
    });

    const stations = response.data?.data || [];
    const myStation = stations.find((s) => s.stationId === stationId);

    res.json({ success: true, data: myStation || null });
  } catch (error) {
    console.error("[Resources] Failed to fetch station:", error.message);

    // If main platform is unreachable, return error
    if (error.code === "ECONNREFUSED") {
      return res.status(503).json({
        success: false,
        message:
          "Main platform is not reachable. Start the main backend server.",
      });
    }

    res.status(error.response?.status || 500).json({
      success: false,
      message: error.response?.data?.message || "Failed to fetch resources",
    });
  }
});

/**
 * POST /api/resources/register
 * Register this station's resources with the main platform
 * Creates a ResourceStation entry linked to this station
 */
router.post("/resources/register", async (req, res) => {
  const {
    mainUrl,
    stationId,
    stationType,
    stationName,
    stationLocation,
    headers,
  } = getPlatformConfig(req);

  try {
    const { fleet, staff, supplies } = req.body;

    const payload = {
      stationId,
      name: stationName,
      type: stationType,
      location: {
        lat: stationLocation.lat,
        lng: stationLocation.lng,
        address: stationLocation.address || "",
      },
      fleet: fleet || [],
      staff: staff || [],
      supplies: supplies || {},
    };

    const response = await axios.post(
      `${mainUrl}/api/resources/stations`,
      payload,
      { headers },
    );

    res.json({ success: true, data: response.data?.data });
  } catch (error) {
    console.error("[Resources] Failed to register:", error.message);

    // If station already exists, try to find it
    if (
      error.response?.status === 400 &&
      error.response?.data?.message?.includes("already exists")
    ) {
      try {
        const getResp = await axios.get(`${mainUrl}/api/resources/stations`, {
          headers,
        });
        const stations = getResp.data?.data || [];
        const existing = stations.find((s) => s.stationId === stationId);
        if (existing) {
          return res.json({
            success: true,
            data: existing,
            message: "Station already registered",
          });
        }
      } catch (e) {
        // Fall through
      }
    }

    if (error.code === "ECONNREFUSED") {
      return res.status(503).json({
        success: false,
        message: "Main platform is not reachable",
      });
    }

    res.status(error.response?.status || 500).json({
      success: false,
      message: error.response?.data?.message || "Failed to register resources",
    });
  }
});

/**
 * PATCH /api/resources/update
 * Update this station's resources (fleet, staff, supplies)
 * Requires the station to be already registered
 */
router.patch("/resources/update", async (req, res) => {
  const { mainUrl, stationId, headers } = getPlatformConfig(req);

  try {
    // First find our station's ID
    const getResp = await axios.get(`${mainUrl}/api/resources/stations`, {
      headers,
    });
    const stations = getResp.data?.data || [];
    const myStation = stations.find((s) => s.stationId === stationId);

    if (!myStation) {
      return res.status(404).json({
        success: false,
        message: "Station not registered yet. Register resources first.",
      });
    }

    // Send the update
    const response = await axios.patch(
      `${mainUrl}/api/resources/stations/${myStation.id}`,
      req.body,
      { headers },
    );

    res.json({ success: true, data: response.data?.data });
  } catch (error) {
    console.error("[Resources] Failed to update:", error.message);

    if (error.code === "ECONNREFUSED") {
      return res.status(503).json({
        success: false,
        message: "Main platform is not reachable",
      });
    }

    res.status(error.response?.status || 500).json({
      success: false,
      message: error.response?.data?.message || "Failed to update resources",
    });
  }
});

export default router;

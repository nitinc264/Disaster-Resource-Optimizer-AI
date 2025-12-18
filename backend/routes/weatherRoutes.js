/**
 * Weather Routes
 * API endpoints for weather data integration
 */

import express from "express";
import {
  getCurrentWeather,
  getWeatherAlerts,
  getWeatherForecast,
} from "../services/weatherService.js";
import { sendSuccess, sendError } from "../utils/apiResponse.js";
import { HTTP_STATUS } from "../constants/index.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

/**
 * GET /api/weather/current
 * Get current weather for a location
 */
router.get("/weather/current", requireAuth, async (req, res) => {
  try {
    const { lat, lon } = req.query;

    if (!lat || !lon) {
      return sendError(
        res,
        "Latitude and longitude are required",
        HTTP_STATUS.BAD_REQUEST
      );
    }

    const weather = await getCurrentWeather(parseFloat(lat), parseFloat(lon));
    sendSuccess(res, weather);
  } catch (error) {
    console.error("Error fetching weather:", error);
    sendError(
      res,
      "Failed to fetch weather data",
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
});

/**
 * GET /api/weather/alerts
 * Get weather alerts for an area
 */
router.get("/weather/alerts", requireAuth, async (req, res) => {
  try {
    const { lat, lon } = req.query;

    if (!lat || !lon) {
      return sendError(
        res,
        "Latitude and longitude are required",
        HTTP_STATUS.BAD_REQUEST
      );
    }

    const alerts = await getWeatherAlerts(parseFloat(lat), parseFloat(lon));
    sendSuccess(res, alerts);
  } catch (error) {
    console.error("Error fetching weather alerts:", error);
    sendError(
      res,
      "Failed to fetch weather alerts",
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
});

/**
 * GET /api/weather/forecast
 * Get weather forecast for next 24 hours
 */
router.get("/weather/forecast", requireAuth, async (req, res) => {
  try {
    const { lat, lon } = req.query;

    if (!lat || !lon) {
      return sendError(
        res,
        "Latitude and longitude are required",
        HTTP_STATUS.BAD_REQUEST
      );
    }

    const forecast = await getWeatherForecast(parseFloat(lat), parseFloat(lon));
    sendSuccess(res, forecast);
  } catch (error) {
    console.error("Error fetching weather forecast:", error);
    sendError(
      res,
      "Failed to fetch weather forecast",
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
});

export default router;

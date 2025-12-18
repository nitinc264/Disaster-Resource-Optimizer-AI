/**
 * Weather Service - OpenWeatherMap Integration
 * Fetches weather data for disaster response operations
 */

import fetch from "node-fetch";
import { logger } from "../utils/appLogger.js";

const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY;
const OPENWEATHER_BASE_URL = "https://api.openweathermap.org/data/2.5";

// Cache weather data for 10 minutes to reduce API calls
const weatherCache = new Map();
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

/**
 * Get current weather for a location
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {Promise<Object>} Weather data
 */
export async function getCurrentWeather(lat, lon) {
  const cacheKey = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  const cached = weatherCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  try {
    if (!OPENWEATHER_API_KEY) {
      logger.warn(
        "OpenWeatherMap API key not configured - set OPENWEATHER_API_KEY in .env"
      );
      return null;
    }

    const url = `${OPENWEATHER_BASE_URL}/weather?lat=${lat}&lon=${lon}&appid=${OPENWEATHER_API_KEY}&units=metric`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Weather API error: ${response.status}`);
    }

    const data = await response.json();
    const weatherData = transformWeatherData(data);

    weatherCache.set(cacheKey, {
      data: weatherData,
      timestamp: Date.now(),
    });

    return weatherData;
  } catch (error) {
    logger.error("Failed to fetch weather data:", error);
    return null;
  }
}

/**
 * Get weather alerts for an area
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {Promise<Array>} Weather alerts
 */
export async function getWeatherAlerts(lat, lon) {
  try {
    if (!OPENWEATHER_API_KEY) {
      return [];
    }

    // OneCall API for alerts (requires subscription)
    const url = `${OPENWEATHER_BASE_URL}/onecall?lat=${lat}&lon=${lon}&appid=${OPENWEATHER_API_KEY}&exclude=minutely,hourly,daily`;
    const response = await fetch(url);

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    return data.alerts || [];
  } catch (error) {
    logger.error("Failed to fetch weather alerts:", error);
    return [];
  }
}

/**
 * Get weather forecast for next 24 hours
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {Promise<Array>} Hourly forecast
 */
export async function getWeatherForecast(lat, lon) {
  try {
    if (!OPENWEATHER_API_KEY) {
      return [];
    }

    const url = `${OPENWEATHER_BASE_URL}/forecast?lat=${lat}&lon=${lon}&appid=${OPENWEATHER_API_KEY}&units=metric&cnt=8`;
    const response = await fetch(url);

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    return data.list.map((item) => ({
      time: new Date(item.dt * 1000).toISOString(),
      temp: item.main.temp,
      humidity: item.main.humidity,
      weather: item.weather[0].main,
      description: item.weather[0].description,
      icon: item.weather[0].icon,
      windSpeed: item.wind.speed,
      rain: item.rain?.["3h"] || 0,
    }));
  } catch (error) {
    logger.error("Failed to fetch weather forecast:", error);
    return [];
  }
}

/**
 * Transform OpenWeatherMap data to our format
 */
function transformWeatherData(data) {
  const weather = data.weather[0];

  // Determine if conditions affect rescue operations
  const affectsOperations = checkOperationalImpact(weather, data);

  return {
    location: data.name,
    lat: data.coord.lat,
    lon: data.coord.lon,
    temperature: Math.round(data.main.temp),
    feelsLike: Math.round(data.main.feels_like),
    humidity: data.main.humidity,
    pressure: data.main.pressure,
    visibility: data.visibility / 1000, // Convert to km
    windSpeed: data.wind.speed,
    windDirection: data.wind.deg,
    clouds: data.clouds.all,
    weather: {
      main: weather.main,
      description: weather.description,
      icon: weather.icon,
      iconUrl: `https://openweathermap.org/img/wn/${weather.icon}@2x.png`,
    },
    rain: data.rain?.["1h"] || 0,
    snow: data.snow?.["1h"] || 0,
    sunrise: new Date(data.sys.sunrise * 1000).toISOString(),
    sunset: new Date(data.sys.sunset * 1000).toISOString(),
    affectsOperations,
    operationalWarnings: getOperationalWarnings(weather, data),
    timestamp: new Date().toISOString(),
  };
}

/**
 * Check if weather conditions affect rescue operations
 */
function checkOperationalImpact(weather, data) {
  const conditions = weather.main.toLowerCase();
  const windSpeed = data.wind.speed;
  const visibility = data.visibility / 1000;
  const rain = data.rain?.["1h"] || 0;

  return (
    conditions.includes("thunderstorm") ||
    conditions.includes("tornado") ||
    conditions.includes("hurricane") ||
    windSpeed > 15 || // > 15 m/s (54 km/h)
    visibility < 1 || // < 1 km
    rain > 10 // > 10 mm/h
  );
}

/**
 * Get specific operational warnings
 */
function getOperationalWarnings(weather, data) {
  const warnings = [];
  const conditions = weather.main.toLowerCase();
  const windSpeed = data.wind.speed;
  const visibility = data.visibility / 1000;
  const rain = data.rain?.["1h"] || 0;

  if (conditions.includes("thunderstorm")) {
    warnings.push({
      type: "severe",
      message: "Thunderstorm - Avoid outdoor operations",
    });
  }
  if (conditions.includes("tornado") || conditions.includes("hurricane")) {
    warnings.push({
      type: "critical",
      message: "Extreme weather - Seek shelter immediately",
    });
  }
  if (windSpeed > 20) {
    warnings.push({
      type: "severe",
      message: `High winds (${Math.round(
        windSpeed * 3.6
      )} km/h) - Helicopter operations suspended`,
    });
  } else if (windSpeed > 15) {
    warnings.push({
      type: "warning",
      message: `Strong winds (${Math.round(
        windSpeed * 3.6
      )} km/h) - Exercise caution`,
    });
  }
  if (visibility < 0.5) {
    warnings.push({
      type: "severe",
      message: "Very low visibility - Limit vehicle operations",
    });
  } else if (visibility < 1) {
    warnings.push({
      type: "warning",
      message: "Low visibility - Use caution when driving",
    });
  }
  if (rain > 20) {
    warnings.push({ type: "severe", message: "Heavy rain - Flash flood risk" });
  } else if (rain > 10) {
    warnings.push({
      type: "warning",
      message: "Moderate rain - Roads may be slippery",
    });
  }
  if (data.main.temp > 40) {
    warnings.push({
      type: "warning",
      message: "Extreme heat - Ensure hydration for teams",
    });
  } else if (data.main.temp < 5) {
    warnings.push({
      type: "warning",
      message: "Cold conditions - Hypothermia risk for survivors",
    });
  }

  return warnings;
}

export default {
  getCurrentWeather,
  getWeatherAlerts,
  getWeatherForecast,
};

import axios from "axios";
import EmergencyStation from "../models/EmergencyStationModel.js";
import EmergencyAlert from "../models/EmergencyAlertModel.js";
import { logger } from "../utils/appLogger.js";

/**
 * Emergency Alert Service
 * Handles dispatching alerts to registered emergency stations
 */

// Mapping of disaster types to emergency service types
// Now returns only the PRIMARY station type to avoid multiple alerts
// Order is by priority - first match wins
const DISASTER_TO_SERVICE_MAP = {
  // Fire-related - Fire station is primary
  fire: ["fire"],
  wildfire: ["fire"],
  explosion: ["fire"],

  // Medical emergencies - Hospital is primary
  medical: ["hospital"],
  injury: ["hospital"],
  cardiac: ["hospital"],
  hospital: ["hospital"],

  // Rescue operations - Rescue station is primary
  flood: ["rescue"],
  earthquake: ["rescue"],
  building_collapse: ["rescue"],
  landslide: ["rescue"],
  trapped: ["rescue"],
  rescue: ["rescue"],

  // Traffic and accidents - Police is primary
  traffic_accident: ["police"],
  accident: ["police"],

  // Hazardous materials - Fire is primary
  hazmat: ["fire"],
  chemical: ["fire"],
  gas_leak: ["fire"],

  // Water emergencies - Rescue is primary
  drowning: ["rescue"],

  // Police matters - crowd control, security incidents
  police: ["police"],
  crime: ["police"],
  security: ["police"],
  stampede: ["police"],
  crowd: ["police"],
  riot: ["police"],
  panic: ["police"],

  // General/Other - Rescue as fallback
  storm: ["rescue"],
  general: ["rescue"],
  other: ["rescue"],
};

// Mapping of need types to emergency types
const NEED_TO_EMERGENCY_MAP = {
  Water: "flood",
  Food: "general",
  Medical: "medical",
  Hospital: "medical",
  Rescue: "rescue",
  Fire: "fire",
  Police: "police",
  Other: "general",
};

/**
 * Determine the emergency type from report/need data
 */
function determineEmergencyType(data) {
  // Check sentinelData tag first (from image analysis)
  if (data.sentinelData?.tag) {
    const tag = data.sentinelData.tag.toLowerCase();
    if (tag.includes("fire") || tag.includes("flame") || tag.includes("smoke"))
      return "fire";
    if (tag.includes("flood") || tag.includes("water")) return "flood";
    if (tag.includes("earthquake") || tag.includes("collapse"))
      return "building_collapse";
    if (tag.includes("accident") || tag.includes("crash"))
      return "traffic_accident";
    if (
      tag.includes("medical") ||
      tag.includes("injury") ||
      tag.includes("hospital") ||
      tag.includes("ambulance")
    )
      return "medical";
    if (tag.includes("rescue") || tag.includes("trapped")) return "rescue";
    if (
      tag.includes("police") ||
      tag.includes("crime") ||
      tag.includes("security") ||
      tag.includes("stampede") ||
      tag.includes("crowd") ||
      tag.includes("riot") ||
      tag.includes("panic")
    )
      return "police";
  }

  // Check text for keywords
  const text = (data.text || data.rawMessage || "").toLowerCase();

  // Fire keywords (high priority)
  if (
    text.includes("fire") ||
    text.includes("burning") ||
    text.includes("flame")
  )
    return "fire";

  // Hazmat - check early before other keywords that might match
  if (
    text.includes("gas leak") ||
    text.includes("gas") ||
    text.includes("chemical") ||
    text.includes("hazmat") ||
    text.includes("hazardous")
  )
    return "hazmat";

  // Police/Security matters - check early since crowd control is critical
  if (
    text.includes("need police") ||
    text.includes("call police") ||
    text.includes("police") ||
    text.includes("stampede") ||
    text.includes("panic") ||
    text.includes("crowd") ||
    text.includes("riot") ||
    text.includes("violence") ||
    text.includes("crime") ||
    text.includes("theft") ||
    text.includes("robbery") ||
    text.includes("security")
  )
    return "police";

  // Rescue/Disaster keywords - check BEFORE medical since rescue situations
  // may mention ambulance/injury but the PRIMARY need is rescue
  if (
    text.includes("trapped") ||
    text.includes("stuck in traffic") ||
    text.includes("road blocked") ||
    text.includes("fallen tree") ||
    text.includes("rescue") ||
    text.includes("elevator") ||
    text.includes("flood") ||
    text.includes("rising water") ||
    text.includes("earthquake") ||
    text.includes("shaking")
  )
    return "rescue";

  // Medical/Hospital keywords - person needs medical attention
  // Check BEFORE building_collapse to prioritize injured person
  if (
    text.includes("need ambulance") ||
    text.includes("send ambulance") ||
    text.includes("hospital") ||
    text.includes("medical") ||
    text.includes("heart") ||
    text.includes("breathing") ||
    text.includes("injured") ||
    text.includes("bleeding") ||
    text.includes("unconscious") ||
    text.includes("pedestrian") ||
    text.includes("collapsed on") ||
    (text.includes("ambulance") && text.includes("immediately"))
  )
    return "medical";

  // Building collapse without explicit injury - rescue team handles
  if (text.includes("collapse") || text.includes("building collapsed"))
    return "building_collapse";

  // Traffic accidents
  if (
    text.includes("accident") ||
    text.includes("crash") ||
    text.includes("collision")
  )
    return "traffic_accident";

  // Check triageData needType
  if (data.triageData?.needType) {
    return NEED_TO_EMERGENCY_MAP[data.triageData.needType] || "general";
  }

  // Check oracleData needs - police/security keywords checked before medical
  if (data.oracleData?.needs) {
    const needs = data.oracleData.needs.map((n) => n.toLowerCase());
    if (needs.includes("fire suppression")) return "fire";
    // Check for crowd control/police needs BEFORE medical
    if (
      needs.includes("police") ||
      needs.includes("crowd control") ||
      needs.includes("security")
    )
      return "police";
    if (needs.includes("medical") || needs.includes("ambulance"))
      return "medical";
    if (needs.includes("rescue")) return "rescue";
    if (needs.includes("evacuation")) return "flood";
  }

  return "general";
}

/**
 * Get appropriate service types for an emergency
 */
function getServiceTypesForEmergency(emergencyType) {
  return (
    DISASTER_TO_SERVICE_MAP[emergencyType] || DISASTER_TO_SERVICE_MAP.general
  );
}

/**
 * Create alert data from a report or need
 */
function createAlertData(sourceData, sourceType, emergencyType) {
  const location =
    sourceType === "Report" ? sourceData.location : sourceData.coordinates;

  const lat = location?.lat || location?.latitude;
  const lng = location?.lng || location?.lon || location?.longitude;

  // Determine severity
  let severity = 5; // Default
  if (sourceData.oracleData?.severity) {
    severity = sourceData.oracleData.severity;
  } else if (sourceData.triageData?.urgency) {
    const urgencyMap = { Low: 3, Medium: 5, High: 8 };
    severity = urgencyMap[sourceData.triageData.urgency] || 5;
  }

  // Create title - use meaningful tag or capitalize emergency type
  const tag =
    sourceData.sentinelData?.tag ||
    (sourceData.triageData?.needType !== "Other"
      ? sourceData.triageData?.needType
      : null) ||
    emergencyType.replace(/_/g, " ");

  const title = `${emergencyType
    .toUpperCase()
    .replace(/_/g, " ")} ALERT: ${tag}`;

  // Create description
  const description =
    sourceData.text ||
    sourceData.rawMessage ||
    sourceData.oracleData?.summary ||
    sourceData.triageData?.details ||
    "Emergency situation reported";

  return {
    sourceType,
    sourceId: sourceData._id,
    sourceDocument: sourceData._id, // Direct reference for callbacks
    emergencyType,
    severity,
    location: {
      lat,
      lng,
      address: sourceData.coordinates?.formattedAddress || null,
    },
    title,
    description,
    needs: sourceData.oracleData?.needs || [],
    metadata: {
      originalText: sourceData.text || sourceData.rawMessage,
      imageUrl: sourceData.imageUrl,
      audioUrl: sourceData.audioUrl,
      aiAnalysis: {
        sentinelData: sourceData.sentinelData,
        oracleData: sourceData.oracleData,
        triageData: sourceData.triageData,
      },
    },
  };
}

/**
 * Send alert to a specific station
 */
async function sendAlertToStation(station, alertData) {
  const endpoint = `${station.apiConfig.baseUrl}${station.apiConfig.alertEndpoint}`;

  try {
    const response = await axios.post(
      endpoint,
      {
        alertId: alertData.alertId,
        emergencyType: alertData.emergencyType,
        severity: alertData.severity,
        location: alertData.location,
        title: alertData.title,
        description: alertData.description,
        needs: alertData.needs,
        timestamp: new Date().toISOString(),
        fromStation: {
          name: "Disaster Response HQ",
          type: "command",
        },
      },
      {
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": station.apiConfig.apiKey,
          "X-Alert-Priority": alertData.severity >= 7 ? "critical" : "normal",
        },
        timeout: 10000, // 10 second timeout
      },
    );

    logger.info(`Alert sent to ${station.name}`, {
      alertId: alertData.alertId,
      stationId: station._id,
      status: response.status,
    });

    return {
      success: true,
      status: "delivered",
      responseData: response.data,
    };
  } catch (error) {
    logger.error(`Failed to send alert to ${station.name}`, {
      alertId: alertData.alertId,
      stationId: station._id,
      error: error.message,
    });

    return {
      success: false,
      status: "failed",
      error: error.message,
    };
  }
}

/**
 * Dispatch emergency alert to appropriate stations
 */
export async function dispatchEmergencyAlert(
  sourceData,
  sourceType = "Report",
) {
  try {
    // Determine emergency type
    const emergencyType = determineEmergencyType(sourceData);
    logger.info(`Determined emergency type: ${emergencyType}`);

    // Get appropriate service types
    const serviceTypes = getServiceTypesForEmergency(emergencyType);
    logger.info(`Service types for ${emergencyType}:`, serviceTypes);

    // Get location
    const location =
      sourceType === "Report" ? sourceData.location : sourceData.coordinates;

    const lat = location?.lat || location?.latitude;
    const lng = location?.lng || location?.lon || location?.longitude;

    if (!lat || !lng) {
      logger.error("Cannot dispatch alert: No location data");
      return { success: false, error: "No location data" };
    }

    // Create alert data
    const alertData = createAlertData(sourceData, sourceType, emergencyType);

    // Create alert record
    const alert = new EmergencyAlert(alertData);
    await alert.save();

    logger.info(`Created emergency alert: ${alert.alertId}`);

    // TARGETED ROUTING: Send alerts only to the appropriate station type
    // based on the emergency type (fire -> fire station, medical -> hospital, etc.)
    const stationsToAlert = [];

    for (const serviceType of serviceTypes) {
      const nearestStations = await EmergencyStation.findNearest(
        lat,
        lng,
        serviceType,
        1, // Get nearest station of each type
      );

      for (const { station, distance } of nearestStations) {
        // Avoid duplicates
        if (!stationsToAlert.find((s) => s.station._id.equals(station._id))) {
          stationsToAlert.push({ station, distance });
        }
      }
    }

    // Fallback: If no stations found for specific types, try police and rescue
    if (stationsToAlert.length === 0) {
      logger.info(
        "No specific stations found, falling back to police and rescue",
      );

      const fallbackTypes = ["police", "rescue"];
      for (const fallbackType of fallbackTypes) {
        if (!serviceTypes.includes(fallbackType)) {
          const nearestStations = await EmergencyStation.findNearest(
            lat,
            lng,
            fallbackType,
            1,
          );

          for (const { station, distance } of nearestStations) {
            if (
              !stationsToAlert.find((s) => s.station._id.equals(station._id))
            ) {
              stationsToAlert.push({ station, distance });
            }
          }
        }
      }
    }

    logger.info(
      `Routing alert to ${stationsToAlert.length} station(s) for emergency type: ${emergencyType}`,
    );

    if (stationsToAlert.length === 0) {
      logger.warn("No active emergency stations found for alert", {
        alertId: alert.alertId,
        emergencyType,
      });

      alert.status = "dispatched";
      alert.dispatchedAt = new Date();
      await alert.save();

      return {
        success: true,
        alertId: alert.alertId,
        stationsNotified: 0,
        message: "Alert created but no stations available",
      };
    }

    // Send alerts to all relevant stations
    const results = [];

    for (const { station, distance } of stationsToAlert) {
      const result = await sendAlertToStation(station, {
        ...alertData,
        alertId: alert.alertId,
      });

      // Record the station in the alert
      alert.sentToStations.push({
        stationId: station._id,
        stationName: station.name,
        stationType: station.type,
        distance,
        sentAt: new Date(),
        deliveryStatus: result.status,
      });

      // Update station stats
      station.stats.totalAlertsReceived += 1;
      station.lastPingAt = new Date();
      await station.save();

      results.push({
        stationName: station.name,
        stationType: station.type,
        distance: distance.toFixed(2) + " km",
        ...result,
      });
    }

    // Update alert status
    alert.status = "dispatched";
    alert.dispatchedAt = new Date();
    alert.sourceDocument = sourceData._id; // Store reference to original report
    await alert.save();

    // Update the source report/need's emergencyStatus
    if (sourceData._id) {
      try {
        const Report = (await import("../models/ReportModel.js")).default;
        const Need = (await import("../models/NeedModel.js")).default;
        const firstStation = stationsToAlert[0]?.station;

        const updateData = {
          emergencyStatus: "assigned",
          emergencyType: emergencyType, // Store the emergency type (e.g., "general", "fire", etc.)
          emergencyAlertId: alert.alertId,
          "assignedStation.stationId": firstStation?._id,
          "assignedStation.stationName": firstStation?.name,
          "assignedStation.stationType": firstStation?.type,
          "assignedStation.assignedAt": new Date(),
        };

        // Try updating Report first, then Need
        const reportUpdate = await Report.findByIdAndUpdate(
          sourceData._id,
          updateData,
        );
        const needUpdate = await Need.findByIdAndUpdate(
          sourceData._id,
          updateData,
        );

        logger.info(
          `Updated ${reportUpdate ? "report" : "need"} ${
            sourceData._id
          } with emergency status: assigned, type: ${emergencyType}`,
        );
      } catch (err) {
        logger.warn(
          `Could not update report/need emergencyStatus: ${err.message}`,
        );
      }
    }

    const successCount = results.filter((r) => r.success).length;

    logger.info(`Emergency alert dispatched`, {
      alertId: alert.alertId,
      totalStations: stationsToAlert.length,
      successfulDeliveries: successCount,
    });

    return {
      success: true,
      alertId: alert.alertId,
      emergencyType,
      severity: alertData.severity,
      stationsNotified: stationsToAlert.length,
      successfulDeliveries: successCount,
      results,
    };
  } catch (error) {
    logger.error("Error dispatching emergency alert:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Dispatch emergency alert to a specific station (used for rerouting)
 * @param {Object} sourceData - The report/need data
 * @param {String} sourceType - "Report" or "Need"
 * @param {Object} targetStation - { type, name, lat, lon }
 */
export async function dispatchAlertToStation(
  sourceData,
  sourceType = "Report",
  targetStation,
) {
  try {
    // Determine emergency type
    const emergencyType = determineEmergencyType(sourceData);
    logger.info(
      `Dispatching rerouted alert to ${targetStation.name} (${targetStation.type})`,
    );

    // Get location
    const location =
      sourceType === "Report" ? sourceData.location : sourceData.coordinates;

    const lat = location?.lat || location?.latitude;
    const lng = location?.lng || location?.lon || location?.longitude;

    if (!lat || !lng) {
      logger.error("Cannot dispatch alert: No location data");
      return { success: false, error: "No location data" };
    }

    // Create alert data
    const alertData = createAlertData(sourceData, sourceType, emergencyType);

    // Create alert record
    const alert = new EmergencyAlert(alertData);
    await alert.save();

    logger.info(`Created emergency alert for reroute: ${alert.alertId}`);

    // Find the target station by name and type
    let targetStationDoc = await EmergencyStation.findOne({
      name: targetStation.name,
      type: targetStation.type,
      status: "active",
    });

    if (!targetStationDoc) {
      logger.warn(
        `Target station not found: ${targetStation.name} (${targetStation.type})`,
      );

      // Try to find any active station of this type
      targetStationDoc = await EmergencyStation.findOne({
        type: targetStation.type,
        status: "active",
      });

      if (!targetStationDoc) {
        alert.status = "dispatched";
        alert.dispatchedAt = new Date();
        await alert.save();

        return {
          success: true,
          alertId: alert.alertId,
          stationsNotified: 0,
          message: "Alert created but target station not available",
        };
      }

      // Use fallback station
      logger.info(`Using fallback station: ${targetStationDoc.name}`);
    }

    // Send alert to the target station
    const result = await sendAlertToStation(targetStationDoc, {
      ...alertData,
      alertId: alert.alertId,
    });

    // Record the station in the alert
    alert.sentToStations.push({
      stationId: targetStationDoc._id,
      stationName: targetStationDoc.name,
      stationType: targetStationDoc.type,
      distance: 0, // Distance not calculated for reroutes
      sentAt: new Date(),
      deliveryStatus: result.status,
    });

    // Update station stats
    targetStationDoc.stats.totalAlertsReceived += 1;
    targetStationDoc.lastPingAt = new Date();
    await targetStationDoc.save();

    // Update alert status
    alert.status = "dispatched";
    alert.dispatchedAt = new Date();
    alert.sourceDocument = sourceData._id;
    await alert.save();

    // Update the source report/need's emergencyStatus
    if (sourceData._id) {
      try {
        const Report = (await import("../models/ReportModel.js")).default;
        const Need = (await import("../models/NeedModel.js")).default;

        const updateData = {
          emergencyStatus: "assigned",
          emergencyType: emergencyType,
          emergencyAlertId: alert.alertId,
          dispatch_status: "Pending",
          "assignedStation.stationId": targetStationDoc._id,
          "assignedStation.stationName": targetStationDoc.name,
          "assignedStation.stationType": targetStationDoc.type,
          "assignedStation.assignedAt": new Date(),
        };

        await Report.findByIdAndUpdate(sourceData._id, updateData);
        await Need.findByIdAndUpdate(sourceData._id, updateData);

        logger.info(
          `Updated report/need ${sourceData._id} with new station assignment`,
        );
      } catch (err) {
        logger.warn(
          `Could not update report/need emergencyStatus: ${err.message}`,
        );
      }
    }

    logger.info(`Rerouted alert dispatched to ${targetStationDoc.name}`, {
      alertId: alert.alertId,
      success: result.success,
    });

    return {
      success: true,
      alertId: alert.alertId,
      emergencyType,
      stationName: targetStationDoc.name,
      stationType: targetStationDoc.type,
      deliveryStatus: result.status,
    };
  } catch (error) {
    logger.error("Error dispatching rerouted alert:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Process acknowledgment from a station
 */
export async function processStationAcknowledgment(
  alertId,
  stationId,
  acknowledgment,
) {
  try {
    const alert = await EmergencyAlert.findOne({ alertId });

    if (!alert) {
      return { success: false, error: "Alert not found" };
    }

    // Find the station entry in sentToStations
    const stationEntry = alert.sentToStations.find(
      (s) => s.stationId.toString() === stationId,
    );

    if (!stationEntry) {
      return { success: false, error: "Station not found in alert" };
    }

    // Update the station entry
    stationEntry.deliveryStatus = "acknowledged";
    stationEntry.acknowledgedAt = new Date();
    stationEntry.responseNotes = acknowledgment.notes;

    // Update alert status if this is the first acknowledgment
    if (alert.status === "dispatched") {
      alert.status = "acknowledged";
      alert.acknowledgedAt = new Date();
    }

    await alert.save();

    // Update station stats
    const station = await EmergencyStation.findById(stationId);
    if (station) {
      station.stats.totalAlertsAcknowledged += 1;

      // Calculate response time
      const responseTime = (new Date() - stationEntry.sentAt) / 1000; // in seconds
      if (station.stats.averageResponseTime) {
        station.stats.averageResponseTime =
          (station.stats.averageResponseTime + responseTime) / 2;
      } else {
        station.stats.averageResponseTime = responseTime;
      }

      await station.save();
    }

    logger.info(`Alert acknowledged by station`, {
      alertId,
      stationId,
      stationName: stationEntry.stationName,
    });

    return {
      success: true,
      alertId,
      stationName: stationEntry.stationName,
      acknowledgedAt: stationEntry.acknowledgedAt,
    };
  } catch (error) {
    logger.error("Error processing acknowledgment:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Register a new emergency station
 */
export async function registerStation(stationData) {
  const station = new EmergencyStation(stationData);
  await station.save();
  logger.info(`New emergency station registered: ${station.name}`);
  return station;
}

/**
 * Update station status
 */
export async function updateStationStatus(stationId, status) {
  const station = await EmergencyStation.findByIdAndUpdate(
    stationId,
    { status, lastPingAt: new Date() },
    { new: true },
  );
  return station;
}

/**
 * Ping station to check if it's online
 */
export async function pingStation(stationId) {
  const station = await EmergencyStation.findById(stationId);

  if (!station) {
    return { success: false, error: "Station not found" };
  }

  try {
    const endpoint = `${station.apiConfig.baseUrl}/api/health`;
    const response = await axios.get(endpoint, {
      headers: {
        "X-API-Key": station.apiConfig.apiKey,
      },
      timeout: 5000,
    });

    station.lastPingAt = new Date();
    station.status = "active";
    await station.save();

    return {
      success: true,
      stationName: station.name,
      status: "online",
      responseTime: response.headers["x-response-time"] || "N/A",
    };
  } catch (error) {
    station.status = "offline";
    await station.save();

    return {
      success: false,
      stationName: station.name,
      status: "offline",
      error: error.message,
    };
  }
}

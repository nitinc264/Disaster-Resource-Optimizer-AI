import mongoose from "mongoose";
import Report from "../models/ReportModel.js";
import Need from "../models/NeedModel.js";
import { sendSuccess, sendError } from "../utils/apiResponse.js";
import { HTTP_STATUS } from "../constants/index.js";

/**
 * Get analytics data
 * @route GET /api/analytics
 */
export const getAnalytics = async (req, res) => {
  try {
    const { timeRange = "24h" } = req.query;

    // Calculate date ranges
    const now = new Date();
    let startDate = new Date();
    let previousStartDate = new Date();

    switch (timeRange) {
      case "1h":
        startDate.setHours(now.getHours() - 1);
        previousStartDate.setHours(now.getHours() - 2);
        break;
      case "6h":
        startDate.setHours(now.getHours() - 6);
        previousStartDate.setHours(now.getHours() - 12);
        break;
      case "7d":
        startDate.setDate(now.getDate() - 7);
        previousStartDate.setDate(now.getDate() - 14);
        break;
      case "30d":
        startDate.setDate(now.getDate() - 30);
        previousStartDate.setDate(now.getDate() - 60);
        break;
      case "24h":
      default:
        startDate.setHours(now.getHours() - 24);
        previousStartDate.setHours(now.getHours() - 48);
        break;
    }

    // Parallelize queries for performance - now querying both Report and Need models
    const [
      // Report model queries
      currentReportStats,
      previousReportStats,
      reportIncidentTypes,
      reportSeverityDistribution,
      reportHotspots,
      recentReports,
      // Need model queries
      currentNeedStats,
      previousNeedStats,
      needIncidentTypes,
      needHotspots,
      recentNeeds,
      // Other
      activeMissionsCount,
    ] = await Promise.all([
      // 1. Current Period Report Stats
      Report.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            resolved: {
              $sum: { $cond: [{ $eq: ["$status", "Resolved"] }, 1, 0] },
            },
            avgResolutionTime: {
              $avg: {
                $cond: [
                  { $eq: ["$status", "Resolved"] },
                  { $subtract: ["$updatedAt", "$createdAt"] },
                  null,
                ],
              },
            },
          },
        },
      ]),

      // 2. Previous Period Report Stats
      Report.aggregate([
        {
          $match: {
            createdAt: { $gte: previousStartDate, $lt: startDate },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            resolved: {
              $sum: { $cond: [{ $eq: ["$status", "Resolved"] }, 1, 0] },
            },
            avgResolutionTime: {
              $avg: {
                $cond: [
                  { $eq: ["$status", "Resolved"] },
                  { $subtract: ["$updatedAt", "$createdAt"] },
                  null,
                ],
              },
            },
          },
        },
      ]),

      // 3. Report Incident Types Distribution
      Report.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        {
          $group: {
            _id: "$sentinelData.tag",
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
      ]),

      // 4. Report Severity Distribution
      Report.aggregate([
        {
          $match: {
            createdAt: { $gte: startDate },
            "oracleData.severity": { $ne: null },
          },
        },
        {
          $group: {
            _id: "$oracleData.severity",
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      // 5. Report Hotspots (Cluster by rounding coordinates)
      Report.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        {
          $group: {
            _id: {
              lat: { $round: ["$location.lat", 3] },
              lng: { $round: ["$location.lng", 3] },
            },
            count: { $sum: 1 },
            name: { $first: "$location.address" }, 
          },
        },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),

      // 6. Recent Reports
      Report.find({ createdAt: { $gte: startDate } })
        .sort({ createdAt: -1 })
        .limit(5)
        .select("status sentinelData createdAt location"),

      // 7. Current Period Need Stats
      Need.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            resolved: {
              $sum: { $cond: [{ $eq: ["$status", "Completed"] }, 1, 0] },
            },
            avgResolutionTime: {
              $avg: {
                $cond: [
                  { $eq: ["$status", "Completed"] },
                  { $subtract: ["$updatedAt", "$createdAt"] },
                  null,
                ],
              },
            },
          },
        },
      ]),

      // 8. Previous Period Need Stats
      Need.aggregate([
        {
          $match: {
            createdAt: { $gte: previousStartDate, $lt: startDate },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            resolved: {
              $sum: { $cond: [{ $eq: ["$status", "Completed"] }, 1, 0] },
            },
          },
        },
      ]),

      // 9. Need Incident Types Distribution (using triageData.needType)
      Need.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        {
          $group: {
            _id: "$triageData.needType",
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
      ]),

      // 10. Need Hotspots (Cluster by rounding coordinates)
      Need.aggregate([
        { 
          $match: { 
            createdAt: { $gte: startDate },
            "coordinates.lat": { $ne: null },
            "coordinates.lon": { $ne: null }
          } 
        },
        {
          $group: {
            _id: {
              lat: { $round: ["$coordinates.lat", 3] },
              lon: { $round: ["$coordinates.lon", 3] },
            },
            count: { $sum: 1 },
            name: { $first: "$coordinates.formattedAddress" }, 
          },
        },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),

      // 11. Recent Needs
      Need.find({ createdAt: { $gte: startDate } })
        .sort({ createdAt: -1 })
        .limit(5)
        .select("status triageData createdAt coordinates rawMessage"),

      // 12. Active Missions Count
      mongoose.connection.db.collection("missions").countDocuments({ status: "Active" }),
    ]);

    // Process Results - Combine Report and Need data
    const currentReport = currentReportStats[0] || { total: 0, resolved: 0, avgResolutionTime: 0 };
    const previousReport = previousReportStats[0] || { total: 0, resolved: 0, avgResolutionTime: 0 };
    const currentNeed = currentNeedStats[0] || { total: 0, resolved: 0, avgResolutionTime: 0 };
    const previousNeed = previousNeedStats[0] || { total: 0, resolved: 0 };

    // Combined stats
    const current = {
      total: currentReport.total + currentNeed.total,
      resolved: currentReport.resolved + currentNeed.resolved,
      avgResolutionTime: currentReport.avgResolutionTime || currentNeed.avgResolutionTime || 0,
    };
    const previous = {
      total: previousReport.total + previousNeed.total,
      resolved: previousReport.resolved + previousNeed.resolved,
    };

    // Helper to get color for incident type
    const getTypeColor = (type) => {
      const colors = {
        fire: "#ef4444",
        flood: "#3b82f6",
        medical: "#10b981",
        earthquake: "#8b5cf6",
        accident: "#f59e0b",
        rescue: "#f97316",
        water: "#0ea5e9",
        food: "#84cc16",
        other: "#6b7280",
      };
      return colors[type?.toLowerCase()] || colors.other;
    };

    // Combine Incident Types from both Report and Need
    const incidentTypeMap = new Map();
    
    // Add report incident types
    reportIncidentTypes.forEach((type) => {
      const name = type._id || "Unknown";
      incidentTypeMap.set(name, (incidentTypeMap.get(name) || 0) + type.count);
    });
    
    // Add need incident types
    needIncidentTypes.forEach((type) => {
      const name = type._id || "Unknown";
      incidentTypeMap.set(name, (incidentTypeMap.get(name) || 0) + type.count);
    });

    // Format combined Incident Types
    const totalIncidents = current.total || 1;
    const formattedIncidentTypes = Array.from(incidentTypeMap.entries())
      .map(([name, count]) => ({
        name,
        count,
        percentage: Math.round((count / totalIncidents) * 100),
        color: getTypeColor(name),
        icon: "AlertTriangle",
      }))
      .sort((a, b) => b.count - a.count);

    // Format Severity from reports (Needs don't have severity, they have urgency)
    const formattedSeverity = reportSeverityDistribution.map((sev) => ({
      severity: sev._id,
      count: sev.count,
      percentage: Math.round((sev.count / totalIncidents) * 100),
    }));

    // Combine Hotspots from both Report and Need
    const hotspotMap = new Map();
    
    // Add report hotspots
    reportHotspots.forEach((spot) => {
      const key = `${spot._id?.lat},${spot._id?.lng}`;
      const existing = hotspotMap.get(key);
      if (existing) {
        existing.count += spot.count;
      } else {
        hotspotMap.set(key, {
          name: spot.name || `Area ${spot._id?.lat}, ${spot._id?.lng}`,
          lat: spot._id?.lat,
          lon: spot._id?.lng,
          count: spot.count,
        });
      }
    });
    
    // Add need hotspots
    needHotspots.forEach((spot) => {
      const key = `${spot._id?.lat},${spot._id?.lon}`;
      const existing = hotspotMap.get(key);
      if (existing) {
        existing.count += spot.count;
      } else {
        hotspotMap.set(key, {
          name: spot.name || `Area ${spot._id?.lat}, ${spot._id?.lon}`,
          lat: spot._id?.lat,
          lon: spot._id?.lon,
          count: spot.count,
        });
      }
    });

    const formattedHotspots = Array.from(hotspotMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Combine and format Recent Activity from both sources
    const allActivity = [
      ...recentReports.map((report) => ({
        type: "report",
        description: `Voice report: ${report.sentinelData?.tag || "incident"}`,
        timestamp: report.createdAt,
        status: report.status,
      })),
      ...recentNeeds.map((need) => ({
        type: "need",
        description: `SMS report: ${need.triageData?.needType || "general"} - ${(need.rawMessage || "").substring(0, 50)}...`,
        timestamp: need.createdAt,
        status: need.status,
      })),
    ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 10);

    // Response Object
    const responseData = {
      current: {
        incidents: current.total,
        avgResponseTime: Math.round((current.avgResolutionTime || 0) / 60000), // ms to minutes
        resolved: current.resolved,
        activeMissions: activeMissionsCount,
      },
      previous: {
        incidents: previous.total,
        avgResponseTime: Math.round((previousReport.avgResolutionTime || 0) / 60000),
        resolved: previous.resolved,
      },
      historical: true,
      incidentTypes: formattedIncidentTypes,
      responseTimeTrend: [
        // Mock trend data for now as it requires complex time-series aggregation
        { label: "00:00", value: 15 },
        { label: "04:00", value: 20 },
        { label: "08:00", value: 12 },
        { label: "12:00", value: 18 },
        { label: "16:00", value: 25 },
        { label: "20:00", value: 10 },
      ],
      severityDistribution: formattedSeverity,
      hotspots: formattedHotspots,
      recentActivity: allActivity,
    };

    sendSuccess(res, responseData);
  } catch (error) {
    console.error("Error in getAnalytics:", error);
    sendError(res, "Failed to fetch analytics data", HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
};

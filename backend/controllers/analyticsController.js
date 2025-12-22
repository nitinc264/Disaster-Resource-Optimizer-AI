import mongoose from "mongoose";
import Report from "../models/ReportModel.js";
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

    // Parallelize queries for performance
    const [
      currentStats,
      previousStats,
      incidentTypes,
      severityDistribution,
      hotspots,
      recentReports,
      activeMissionsCount,
    ] = await Promise.all([
      // 1. Current Period Stats
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

      // 2. Previous Period Stats
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

      // 3. Incident Types Distribution
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

      // 4. Severity Distribution
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

      // 5. Hotspots (Cluster by rounding coordinates)
      Report.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        {
          $group: {
            _id: {
              lat: { $round: ["$location.lat", 3] },
              lng: { $round: ["$location.lng", 3] },
            },
            count: { $sum: 1 },
            // Get the first location name/address if available, or just use coords
            name: { $first: "$location.address" }, 
          },
        },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),

      // 6. Recent Activity (Reports)
      Report.find({ createdAt: { $gte: startDate } })
        .sort({ createdAt: -1 })
        .limit(10)
        .select("status sentinelData createdAt location"),

      // 7. Active Missions Count
      mongoose.connection.db.collection("missions").countDocuments({ status: "Active" }),
    ]);

    // Process Results
    const current = currentStats[0] || {
      total: 0,
      resolved: 0,
      avgResolutionTime: 0,
    };
    const previous = previousStats[0] || {
      total: 0,
      resolved: 0,
      avgResolutionTime: 0,
    };

    // Helper to get color for incident type
    const getTypeColor = (type) => {
      const colors = {
        fire: "#ef4444",
        flood: "#3b82f6",
        medical: "#10b981",
        earthquake: "#8b5cf6",
        accident: "#f59e0b",
        other: "#6b7280",
      };
      return colors[type?.toLowerCase()] || colors.other;
    };

    // Format Incident Types
    const totalIncidents = current.total || 1;
    const formattedIncidentTypes = incidentTypes.map((type) => ({
      name: type._id || "Unknown",
      count: type.count,
      percentage: Math.round((type.count / totalIncidents) * 100),
      color: getTypeColor(type._id),
      icon: "AlertTriangle", // Frontend maps this string to icon component
    }));

    // Format Severity
    const formattedSeverity = severityDistribution.map((sev) => ({
      severity: sev._id,
      count: sev.count,
      percentage: Math.round((sev.count / totalIncidents) * 100),
    }));

    // Format Hotspots
    const formattedHotspots = hotspots.map((spot) => ({
      name: spot.name || `Area ${spot._id.lat}, ${spot._id.lng}`,
      lat: spot._id.lat,
      lon: spot._id.lng,
      count: spot.count,
    }));

    // Format Recent Activity
    const formattedActivity = recentReports.map((report) => ({
      type: "report",
      description: `New ${report.sentinelData?.tag || "incident"} reported`,
      timestamp: report.createdAt,
      status: report.status,
    }));

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
        avgResponseTime: Math.round((previous.avgResolutionTime || 0) / 60000),
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
      recentActivity: formattedActivity,
    };

    sendSuccess(res, responseData);
  } catch (error) {
    console.error("Error in getAnalytics:", error);
    sendError(res, "Failed to fetch analytics data", HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
};

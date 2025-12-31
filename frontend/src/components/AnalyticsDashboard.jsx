import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  Clock,
  TrendingUp,
  TrendingDown,
  MapPin,
  AlertTriangle,
  CheckCircle,
  Activity,
  Calendar,
  Filter,
  Flame,
  Droplets,
  Stethoscope,
  Car,
  HelpCircle,
} from "lucide-react";
import { getAnalytics } from "../services";
import "./AnalyticsDashboard.css";

const ICON_MAP = {
  fire: <Flame size={14} />,
  flood: <Droplets size={14} />,
  medical: <Stethoscope size={14} />,
  accident: <Car size={14} />,
  default: <AlertTriangle size={14} />,
};

/**
 * Analytics Dashboard with metrics, trends, and heatmap data
 */
export default function AnalyticsDashboard() {
  const { t } = useTranslation();
  const [timeRange, setTimeRange] = useState("24h");

  const { data: analytics = {}, isLoading } = useQuery({
    queryKey: ["analytics", timeRange],
    queryFn: () => getAnalytics({ timeRange }),
    refetchInterval: 60000, // Refresh every minute
  });

  // Calculate trends
  const trends = useMemo(() => {
    if (!analytics.historical) return {};
    const current = analytics.current || {};
    const previous = analytics.previous || {};

    const calcTrend = (curr, prev) => {
      if (!prev || prev === 0) return null; // Return null instead of 0 for no comparison
      const trend = Math.round(((curr - prev) / prev) * 100);
      return isNaN(trend) ? null : trend;
    };

    return {
      incidents: calcTrend(current.incidents, previous.incidents),
      responseTime: calcTrend(
        current.avgResponseTime,
        previous.avgResponseTime
      ),
      resolved: calcTrend(current.resolved, previous.resolved),
    };
  }, [analytics]);

  if (isLoading) {
    return (
      <div className="analytics-loading">
        <Activity size={24} className="pulse" />
        <span>{t("analytics.loading")}</span>
      </div>
    );
  }

  return (
    <div className="analytics-dashboard">
      {/* Header with Time Range Filter */}
      <div className="analytics-header">
        <h2>
          <BarChart3 size={20} />
          {t("analytics.title")}
        </h2>
        <div className="time-filter">
          <Filter size={14} />
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
          >
            <option value="1h">{t("analytics.lastHour")}</option>
            <option value="6h">{t("analytics.last6Hours")}</option>
            <option value="24h">{t("analytics.last24Hours")}</option>
            <option value="7d">{t("analytics.last7Days")}</option>
            <option value="30d">{t("analytics.last30Days")}</option>
          </select>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="metrics-grid">
        <MetricCard
          title={t("analytics.totalIncidents")}
          value={analytics.current?.incidents || 0}
          trend={trends.incidents}
          icon={AlertTriangle}
          color="#f59e0b"
        />
        <MetricCard
          title={t("analytics.avgResponseTime")}
          value={formatDuration(analytics.current?.avgResponseTime || 0)}
          trend={trends.responseTime !== null ? -trends.responseTime : null} // Negative is good for response time
          trendInverted
          icon={Clock}
          color="#3b82f6"
        />
        <MetricCard
          title={t("analytics.resolvedIncidents")}
          value={analytics.current?.resolved || 0}
          trend={trends.resolved}
          icon={CheckCircle}
          color="#10b981"
        />
        <MetricCard
          title={t("analytics.activeMissions")}
          value={analytics.current?.activeMissions || 0}
          icon={Activity}
          color="#8b5cf6"
        />
      </div>

      {/* Charts Row */}
      <div className="charts-row">
        {/* Incident Types Distribution */}
        <div className="chart-card">
          <h3>{t("analytics.incidentTypes")}</h3>
          <div className="distribution-chart">
            {(analytics.incidentTypes || []).length > 0 ? (
              (analytics.incidentTypes || []).map((type) => (
                <div key={type.name} className="distribution-bar">
                  <div className="bar-label">
                    <span className="bar-icon">
                      {ICON_MAP[type.name.toLowerCase()] || ICON_MAP.default}
                    </span>
                    <span>{type.name}</span>
                  </div>
                  <div className="bar-container">
                    <div
                      className="bar-fill"
                      style={{
                        width: `${type.percentage}%`,
                        background: type.color,
                      }}
                    />
                    <span className="bar-value">{type.count}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-chart-state">
                <AlertTriangle size={32} />
                <p>{t("analytics.noIncidents", "No incidents reported in this period")}</p>
              </div>
            )}
          </div>
        </div>

        {/* Response Time Trend */}
        <div className="chart-card">
          <h3>{t("analytics.responseTimeTrend")}</h3>
          {(analytics.responseTimeTrend || []).length > 0 ? (
            <>
              <div className="sparkline-chart">
                {(analytics.responseTimeTrend || []).map((point, idx) => (
                  <div
                    key={idx}
                    className="sparkline-bar"
                    style={{
                      height: `${Math.min(100, (point.value / 60) * 100)}%`,
                    }}
                    title={`${point.label}: ${formatDuration(point.value)}`}
                  />
                ))}
              </div>
              <div className="sparkline-labels">
                {(analytics.responseTimeTrend || [])
                  .filter(
                    (_, i, arr) =>
                      i === 0 ||
                      i === arr.length - 1 ||
                      i === Math.floor(arr.length / 2)
                  )
                  .map((point, idx) => (
                    <span key={idx}>{point.label}</span>
                  ))}
              </div>
            </>
          ) : (
            <div className="empty-chart-state">
              <Clock size={32} />
              <p>{t("analytics.noResponseData", "No response time data available")}</p>
            </div>
          )}
        </div>
      </div>

      {/* Severity Distribution */}
      <div className="chart-card full-width">
        <h3>{t("analytics.severityDistribution")}</h3>
        <div className="severity-chart">
          {(analytics.severityDistribution || []).length > 0 ? (
            (analytics.severityDistribution || []).map((level) => (
              <div key={level.severity} className="severity-item">
                <div className="severity-bar-wrapper">
                  <div
                    className="severity-bar"
                    style={{
                      height: `${level.percentage}%`,
                      background: getSeverityColor(level.severity),
                    }}
                  />
                </div>
                <span className="severity-label">{level.severity}</span>
                <span className="severity-count">{level.count}</span>
              </div>
            ))
          ) : (
            <div className="empty-chart-state">
              <Activity size={32} />
              <p>{t("analytics.noSeverityData", "No severity data available")}</p>
            </div>
          )}
        </div>
      </div>

      {/* Hotspots / Heatmap Data */}
      <div className="chart-card full-width">
        <h3>
          <MapPin size={16} />
          {t("analytics.incidentHotspots")}
        </h3>
        <div className="hotspots-list">
          {(analytics.hotspots || []).length > 0 ? (
            (analytics.hotspots || []).slice(0, 5).map((spot, idx) => (
              <div key={idx} className="hotspot-item">
                <span className="hotspot-rank">#{idx + 1}</span>
                <div className="hotspot-info">
                  <span className="hotspot-name">{spot.name}</span>
                  <span className="hotspot-coords">
                    {spot.lat?.toFixed(4)}, {spot.lon?.toFixed(4)}
                  </span>
                </div>
                <div className="hotspot-stats">
                  <span className="hotspot-count">{spot.count}</span>
                  <span className="hotspot-label">
                    {t("analytics.incidents")}
                  </span>
                </div>
                <div
                  className="hotspot-intensity"
                  style={{
                    background: `linear-gradient(90deg, #fef3c7, ${
                      spot.count > 10
                        ? "#dc2626"
                        : spot.count > 5
                        ? "#f59e0b"
                        : "#fbbf24"
                    })`,
                    width: `${Math.min(100, spot.count * 10)}%`,
                  }}
                />
              </div>
            ))
          ) : (
            <div className="empty-chart-state">
              <MapPin size={32} />
              <p>{t("analytics.noHotspots", "No incident hotspots identified")}</p>
            </div>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="chart-card full-width">
        <h3>
          <Calendar size={16} />
          {t("analytics.recentActivity")}
        </h3>
        <div className="activity-timeline">
          {(analytics.recentActivity || []).length > 0 ? (
            (analytics.recentActivity || []).slice(0, 8).map((activity, idx) => (
              <div key={idx} className="activity-item">
                <div className={`activity-dot ${activity.type}`} />
                <div className="activity-content">
                  <span className="activity-text">{activity.description}</span>
                  <span className="activity-time">
                    {formatTime(activity.timestamp)}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="empty-chart-state">
              <Calendar size={32} />
              <p>{t("analytics.noRecentActivity", "No recent activity to display")}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Metric Card Component
 */
function MetricCard({ title, value, trend, trendInverted, icon: Icon, color }) {
  const showTrend = typeof trend === "number" && !isNaN(trend);
  const isPositive = trendInverted ? trend < 0 : trend > 0;

  return (
    <div className="metric-card" style={{ "--metric-color": color }}>
      <div className="metric-icon">
        <Icon size={20} />
      </div>
      <div className="metric-content">
        <span className="metric-value">{value}</span>
        <span className="metric-title">{title}</span>
      </div>
      {showTrend && (
        <div className={`metric-trend ${isPositive ? "positive" : "negative"}`}>
          {isPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
          <span>{Math.abs(trend)}%</span>
        </div>
      )}
    </div>
  );
}

// Helper functions
function formatDuration(minutes) {
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return `${hours}h ${mins}m`;
}

function formatTime(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
  return date.toLocaleDateString();
}

function getSeverityColor(severity) {
  const colors = {
    1: "#22c55e",
    2: "#4ade80",
    3: "#86efac",
    4: "#fef08a",
    5: "#fde047",
    6: "#facc15",
    7: "#fb923c",
    8: "#f97316",
    9: "#ef4444",
    10: "#dc2626",
  };
  return colors[severity] || "#6b7280";
}

import { useState } from "react";
import { useTranslation } from "react-i18next";
import "./MissionPanel.css";

// Route colors matching Map.jsx
const ROUTE_COLORS = {
  police: "#3b82f6",
  hospital: "#ef4444",
  fire: "#f97316",
  rescue: "#10b981",
  default: "#8b5cf6",
};

const STATION_ICONS = {
  police: "🚔",
  hospital: "🏥",
  fire: "🚒",
  rescue: "⛑️",
};

function MissionPanel({
  missions,
  missionRoutes,
  onCompleteMission,
  onStartReroute,
  reroutingMissionId,
  onCancelReroute,
}) {
  const { t } = useTranslation();
  const [expandedMissionId, setExpandedMissionId] = useState(null);

  const toggleExpand = (missionId) => {
    setExpandedMissionId(expandedMissionId === missionId ? null : missionId);
  };

  const formatDistance = (meters) => {
    if (!meters) return t("common.na");
    return meters >= 1000
      ? `${(meters / 1000).toFixed(1)} km`
      : `${Math.round(meters)} m`;
  };

  // Count totals
  const totalVehicles = missionRoutes.length;
  const totalStops = missionRoutes.reduce(
    (sum, r) => sum + (r.route?.length || 0) - 2, // Exclude depot start/end
    0,
  );

  return (
    <div className="mission-panel">
      {/* Re-routing mode banner */}
      {reroutingMissionId && (
        <div className="reroute-banner">
          <span>🎯 {t("mission.rerouteBanner")}</span>
          <button className="btn-cancel-reroute" onClick={onCancelReroute}>
            {t("common.cancel")}
          </button>
        </div>
      )}

      {/* Quick Stats */}
      <div className="mission-quick-stats">
        <div className="quick-stat">
          <span className="quick-stat-value">{totalVehicles}</span>
          <span className="quick-stat-label">{t("mission.vehicles")}</span>
        </div>
        <div className="quick-stat">
          <span className="quick-stat-value">{totalStops}</span>
          <span className="quick-stat-label">{t("mission.stops")}</span>
        </div>
      </div>

      {/* Mission List */}
      <div className="mission-list">
        {missions.length === 0 ? (
          <div className="no-missions">
            <span className="no-missions-icon">📭</span>
            <p>{t("mission.noMissions")}</p>
            <small>{t("mission.noMissionsHint")}</small>
          </div>
        ) : (
          missions.map((mission) => {
            const isRerouting = reroutingMissionId === mission.id;
            const isExpanded = expandedMissionId === mission.id;
            const totalDistance = (mission.routes || []).reduce(
              (sum, r) => sum + (r.total_distance || 0),
              0,
            );
            const totalRouteStops = (mission.routes || []).reduce(
              (sum, r) => sum + (r.route?.length - 2 || 0),
              0,
            );

            return (
              <div
                key={mission.id}
                className={`mission-card ${isRerouting ? "rerouting" : ""} ${
                  isExpanded ? "expanded" : ""
                }`}
              >
                <div
                  className="mission-card-header"
                  onClick={() => toggleExpand(mission.id)}
                >
                  <div className="mission-info">
                    <span
                      className="mission-station-icon"
                      style={{
                        background:
                          ROUTE_COLORS[mission.station?.type] ||
                          ROUTE_COLORS.default,
                      }}
                    >
                      {STATION_ICONS[mission.station?.type] || "📍"}
                    </span>
                    <div className="mission-details">
                      <span className="mission-name">
                        {mission.station?.name || t("mission.mission")}
                      </span>
                      <span className="mission-meta">
                        {formatDistance(totalDistance)} • {totalRouteStops}{" "}
                        {t("mission.stops")}
                      </span>
                    </div>
                  </div>
                  <span
                    className={`expand-icon ${isExpanded ? "expanded" : ""}`}
                  >
                    ›
                  </span>
                </div>

                {isExpanded && (
                  <div className="mission-card-body">
                    {/* Route details */}
                    <div className="route-list">
                      {(mission.routes || []).map((route, idx) => (
                        <div key={idx} className="route-item">
                          <div
                            className="route-color-bar"
                            style={{
                              background:
                                ROUTE_COLORS[route.station_type] ||
                                ROUTE_COLORS.default,
                            }}
                          />
                          <div className="route-info">
                            <span className="route-vehicle">
                              {t("mission.vehicle")} {route.vehicle_id}
                            </span>
                            <span className="route-distance">
                              {formatDistance(route.total_distance)}
                            </span>
                          </div>
                          <span className="route-stops">
                            {route.route?.length - 2 || 0}{" "}
                            {t("mission.stops").toLowerCase()}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Actions */}
                    <div className="mission-actions">
                      {/* Hide reroute button if any report/need has been dispatched (orange pin) */}
                      {!mission.hasDispatched && (
                        <button
                          className={`btn-reroute ${isRerouting ? "active" : ""}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onStartReroute(mission.id);
                          }}
                          disabled={reroutingMissionId && !isRerouting}
                        >
                          {isRerouting
                            ? `⏳ ${t("mission.rerouteSelect")}`
                            : `🔄 ${t("mission.reroute")}`}
                        </button>
                      )}
                      <button
                        className="btn-complete"
                        onClick={(e) => {
                          e.stopPropagation();
                          onCompleteMission(mission.id);
                        }}
                        disabled={!!reroutingMissionId}
                      >
                        ✓ {t("mission.complete")}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default MissionPanel;

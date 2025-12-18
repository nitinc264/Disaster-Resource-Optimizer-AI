import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { getResourceStations } from "../services";
import {
  Truck,
  Building2,
  Users,
  Package,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  MapPin,
} from "lucide-react";
import "./ResourceTracker.css";

// Station type icons and colors
const STATION_CONFIG = {
  police: {
    icon: "🚔",
    color: "#3b82f6",
    bgColor: "#eff6ff",
  },
  hospital: {
    icon: "🏥",
    color: "#ef4444",
    bgColor: "#fef2f2",
  },
  fire: {
    icon: "🚒",
    color: "#f97316",
    bgColor: "#fff7ed",
  },
  rescue: {
    icon: "⛑️",
    color: "#10b981",
    bgColor: "#f0fdf4",
  },
};

/**
 * Resource Tracker Panel - Shows real-time availability
 */
export default function ResourceTracker({ compact = false }) {
  const { t } = useTranslation();
  const [expandedStation, setExpandedStation] = useState(null);

  const {
    data: stations = [],
    isLoading,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["resourceStations"],
    queryFn: async () => (await getResourceStations()) || [],
    refetchInterval: 30000, // Refresh every 30 seconds
    staleTime: 10000,
  });

  // Calculate summary stats
  const summary = useMemo(() => {
    return stations.reduce(
      (acc, station) => {
        acc.totalVehicles += station.vehicles?.total || 0;
        acc.availableVehicles += station.vehicles?.available || 0;
        acc.totalPersonnel += station.personnel?.total || 0;
        acc.availablePersonnel += station.personnel?.available || 0;
        return acc;
      },
      {
        totalVehicles: 0,
        availableVehicles: 0,
        totalPersonnel: 0,
        availablePersonnel: 0,
      }
    );
  }, [stations]);

  const toggleStation = (stationId) => {
    setExpandedStation(expandedStation === stationId ? null : stationId);
  };

  if (isLoading) {
    return (
      <div className="resource-tracker loading">
        <RefreshCw size={20} className="spin" />
        <span>{t("resources.loading")}</span>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="resource-tracker-compact">
        <div className="resource-summary-row">
          <div className="resource-stat">
            <Truck size={14} />
            <span>
              {summary.availableVehicles}/{summary.totalVehicles}
            </span>
          </div>
          <div className="resource-stat">
            <Users size={14} />
            <span>
              {summary.availablePersonnel}/{summary.totalPersonnel}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="resource-tracker">
      <div className="resource-tracker-header">
        <h3>
          <Building2 size={18} /> {t("resources.title")}
        </h3>
        <button
          className="btn-refresh-resources"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw size={14} className={isFetching ? "spin" : ""} />
        </button>
      </div>

      {/* Summary Stats */}
      <div className="resource-summary">
        <div className="summary-card">
          <Truck size={20} />
          <div className="summary-info">
            <span className="summary-value">
              {summary.availableVehicles}
              <span className="summary-total">/{summary.totalVehicles}</span>
            </span>
            <span className="summary-label">
              {t("resources.vehiclesAvailable")}
            </span>
          </div>
        </div>
        <div className="summary-card">
          <Users size={20} />
          <div className="summary-info">
            <span className="summary-value">
              {summary.availablePersonnel}
              <span className="summary-total">/{summary.totalPersonnel}</span>
            </span>
            <span className="summary-label">
              {t("resources.personnelAvailable")}
            </span>
          </div>
        </div>
      </div>

      {/* Station List */}
      <div className="station-list">
        {stations.map((station) => {
          const config = STATION_CONFIG[station.type] || STATION_CONFIG.rescue;
          const isExpanded = expandedStation === station.id;
          const vehiclePercent = station.vehicles
            ? (station.vehicles.available / station.vehicles.total) * 100
            : 0;

          return (
            <div
              key={station.id}
              className={`station-card ${isExpanded ? "expanded" : ""}`}
              style={{ "--station-color": config.color }}
            >
              <button
                className="station-header"
                onClick={() => toggleStation(station.id)}
              >
                <span className="station-icon">{config.icon}</span>
                <div className="station-info">
                  <span className="station-name">{station.name}</span>
                  <span className="station-type">
                    {t(`resources.${station.type}`)}
                  </span>
                </div>
                <div className="station-availability">
                  <span
                    className={`availability-indicator ${
                      vehiclePercent > 50
                        ? "high"
                        : vehiclePercent > 20
                        ? "medium"
                        : "low"
                    }`}
                  >
                    {station.vehicles?.available || 0}/
                    {station.vehicles?.total || 0}
                  </span>
                  {isExpanded ? (
                    <ChevronUp size={16} />
                  ) : (
                    <ChevronDown size={16} />
                  )}
                </div>
              </button>

              {isExpanded && (
                <div className="station-details">
                  {/* Location */}
                  <div className="detail-row">
                    <MapPin size={14} />
                    <span>
                      {station.lat?.toFixed(4)}, {station.lon?.toFixed(4)}
                    </span>
                  </div>

                  {/* Vehicles */}
                  <div className="detail-section">
                    <h5>
                      <Truck size={14} /> {t("resources.vehicles")}
                    </h5>
                    <div className="availability-bar">
                      <div
                        className="availability-fill"
                        style={{ width: `${vehiclePercent}%` }}
                      />
                    </div>
                    <div className="availability-details">
                      <span>
                        {t("resources.available")}:{" "}
                        {station.vehicles?.available || 0}
                      </span>
                      <span>
                        {t("resources.deployed")}:{" "}
                        {station.vehicles?.deployed || 0}
                      </span>
                    </div>
                  </div>

                  {/* Personnel */}
                  <div className="detail-section">
                    <h5>
                      <Users size={14} /> {t("resources.personnel")}
                    </h5>
                    <div className="personnel-stats">
                      <span className="stat-available">
                        {station.personnel?.available || 0}{" "}
                        {t("resources.available")}
                      </span>
                      <span className="stat-onDuty">
                        {station.personnel?.onDuty || 0} {t("resources.onDuty")}
                      </span>
                    </div>
                  </div>

                  {/* Supplies */}
                  {station.supplies && (
                    <div className="detail-section">
                      <h5>
                        <Package size={14} /> {t("resources.supplies")}
                      </h5>
                      <div className="supplies-grid">
                        {Object.entries(station.supplies).map(
                          ([key, value]) => (
                            <div key={key} className="supply-item">
                              <span className="supply-name">
                                {t(`resources.supply.${key}`, key)}
                              </span>
                              <span
                                className={`supply-status ${
                                  value > 50
                                    ? "good"
                                    : value > 20
                                    ? "low"
                                    : "critical"
                                }`}
                              >
                                {value}%
                              </span>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import {
  Truck,
  Users,
  Package,
  AlertTriangle,
  RefreshCw,
  Activity,
  Building2,
  Loader2,
  WifiOff,
} from "lucide-react";
import { getResourceSummary } from "../services/apiService";
import "./ResourcesPage.css";

// Translation key maps for vehicle types
const FLEET_TYPE_KEYS = {
  ambulance: "resourcesPage.items.ambulance",
  fire_truck: "resourcesPage.items.fireTruck",
  supply_truck: "resourcesPage.items.supplyTruck",
  rescue_helicopter: "resourcesPage.items.rescueHelicopter",
  mobile_command: "resourcesPage.items.mobileCommandUnit",
  patrol_car: "resourcesPage.items.patrolCar",
  rescue_boat: "resourcesPage.items.rescueBoat",
};

// Translation key maps for personnel roles
const STAFF_ROLE_KEYS = {
  paramedic: "resourcesPage.items.paramedics",
  firefighter: "resourcesPage.items.firefighters",
  search_rescue: "resourcesPage.items.searchRescue",
  medical_doctor: "resourcesPage.items.medicalDoctors",
  logistics: "resourcesPage.items.logisticsStaff",
  police_officer: "resourcesPage.items.policeOfficer",
  volunteer: "resourcesPage.items.volunteers",
  driver: "resourcesPage.items.drivers",
};

// Supply type config
const SUPPLY_CONFIG = {
  water: {
    icon: "💧",
    labelKey: "inventory.water",
    unitKey: "inventory.unitL",
  },
  medical: {
    icon: "🏥",
    labelKey: "inventory.medicalKits",
    unitKey: "inventory.unitKits",
  },
  blankets: {
    icon: "🛏️",
    labelKey: "inventory.blankets",
    unitKey: "inventory.unitPcs",
  },
  food: {
    icon: "🍱",
    labelKey: "inventory.foodPackets",
    unitKey: "inventory.unitPkts",
  },
};

export default function ResourcesPage() {
  const { t } = useTranslation();

  const {
    data: summary,
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["resourceSummary"],
    queryFn: getResourceSummary,
    refetchInterval: 30000,
    staleTime: 10000,
  });

  // Convert breakdown objects into sorted arrays
  const fleetItems = useMemo(() => {
    if (!summary?.fleetBreakdown) return [];
    return Object.entries(summary.fleetBreakdown)
      .map(([type, data]) => ({ type, ...data }))
      .sort((a, b) => b.total - a.total);
  }, [summary]);

  const staffItems = useMemo(() => {
    if (!summary?.staffBreakdown) return [];
    return Object.entries(summary.staffBreakdown)
      .map(([role, data]) => ({ role, ...data }))
      .sort((a, b) => b.total - a.total);
  }, [summary]);

  const supplyItems = useMemo(() => {
    if (!summary?.supplies) return [];
    return Object.entries(summary.supplies)
      .filter(([, data]) => data.maximum > 0)
      .map(([type, data]) => ({ type, ...data }));
  }, [summary]);

  const getAvailabilityPercentage = (available, total) => {
    if (!total) return 0;
    return Math.round((available / total) * 100);
  };

  const getStatusClass = (percentage) => {
    if (percentage >= 70) return "good";
    if (percentage >= 40) return "warning";
    return "critical";
  };

  if (isLoading) {
    return (
      <div className="resources-page">
        <div className="resources-loading">
          <Loader2 size={32} className="spin" />
          <span>{t("common.loading")}</span>
        </div>
      </div>
    );
  }

  if (isError || !summary) {
    return (
      <div className="resources-page">
        <div className="resources-error">
          <WifiOff size={32} />
          <h3>{t("resourcesPage.loadError")}</h3>
          <p>{t("resourcesPage.loadErrorHint")}</p>
          <button className="btn-refresh" onClick={() => refetch()}>
            <RefreshCw size={18} />
            {t("resourcesPage.refresh")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="resources-page">
      <div className="resources-container">
        {/* Header */}
        <div className="resources-header">
          <div className="resources-header-content">
            <div>
              <h1>{t("resourcesPage.title")}</h1>
              <p>{t("resourcesPage.subtitle")}</p>
            </div>
            <div className="resources-header-actions">
              <span className="station-count">
                <Building2 size={16} />
                {t("resourcesPage.stationCount", {
                  count: summary.totalStations || 0,
                })}
              </span>
              <button
                className="btn-refresh"
                onClick={() => refetch()}
                disabled={isFetching}
              >
                <RefreshCw size={18} className={isFetching ? "spin" : ""} />
                {isFetching ? t("common.loading") : t("resourcesPage.refresh")}
              </button>
            </div>
          </div>
        </div>

        {/* Low Stock Alerts */}
        {summary.lowStockAlerts?.length > 0 && (
          <div className="low-stock-alerts">
            <div className="alert-banner">
              <AlertTriangle size={20} />
              <span>
                {t("resourcesPage.lowStockWarning", {
                  count: summary.lowStockAlerts.length,
                })}
              </span>
            </div>
            <div className="alert-items">
              {summary.lowStockAlerts.slice(0, 5).map((alert, _idx) => (
                <div
                  key={`${alert.stationName}-${alert.type}`}
                  className="alert-chip"
                >
                  <strong>{alert.stationName}</strong>:{" "}
                  {t(SUPPLY_CONFIG[alert.type]?.labelKey || alert.type)} (
                  {alert.current}/{alert.minimum})
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Resource Availability Section */}
        <section>
          <h2 className="section-title">
            <Activity size={24} />
            {t("resourcesPage.availability")}
          </h2>

          <div className="resources-grid">
            {/* Fleet Vehicles Card */}
            <div className="resource-card">
              <div className="resource-card-header">
                <div className="resource-card-icon-group">
                  <div className="resource-card-icon blue">
                    <Truck size={24} />
                  </div>
                  <div>
                    <h3 className="resource-card-title">
                      {t("resourcesPage.fleetVehicles")}
                    </h3>
                    <p className="resource-card-subtitle">
                      {t("resourcesPage.allVehicleTypes")}
                    </p>
                  </div>
                </div>
                <div className="resource-card-stats">
                  <div className="resource-card-count">
                    {summary.vehicles.available}
                    <span>/{summary.vehicles.total}</span>
                  </div>
                  <div
                    className={`resource-card-percentage ${getStatusClass(
                      getAvailabilityPercentage(
                        summary.vehicles.available,
                        summary.vehicles.total,
                      ),
                    )}`}
                  >
                    {getAvailabilityPercentage(
                      summary.vehicles.available,
                      summary.vehicles.total,
                    )}
                    {t("resourcesPage.percentAvailable")}
                  </div>
                </div>
              </div>

              <div className="resource-items-list">
                {fleetItems.map((vehicle) => {
                  const percentage = getAvailabilityPercentage(
                    vehicle.available,
                    vehicle.total,
                  );
                  return (
                    <div key={vehicle.type} className="resource-item">
                      <span className="resource-item-name">
                        {t(FLEET_TYPE_KEYS[vehicle.type] || vehicle.type)}
                      </span>
                      <div className="resource-item-stats">
                        <div className="resource-item-count">
                          <strong>{vehicle.available}</strong>
                          <span>/{vehicle.total}</span>
                          {vehicle.inUse > 0 && (
                            <span className="deployed-badge">
                              {vehicle.inUse} {t("resourcesPage.deployed")}
                            </span>
                          )}
                        </div>
                        <div className="progress-bar">
                          <div
                            className={`progress-bar-fill ${getStatusClass(percentage)}`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
                {fleetItems.length === 0 && (
                  <div className="empty-state-small">
                    {t("resourcesPage.noFleetData")}
                  </div>
                )}
              </div>
            </div>

            {/* Personnel Card */}
            <div className="resource-card">
              <div className="resource-card-header">
                <div className="resource-card-icon-group">
                  <div className="resource-card-icon purple">
                    <Users size={24} />
                  </div>
                  <div>
                    <h3 className="resource-card-title">
                      {t("resourcesPage.personnel")}
                    </h3>
                    <p className="resource-card-subtitle">
                      {t("resourcesPage.allRoles")}
                    </p>
                  </div>
                </div>
                <div className="resource-card-stats">
                  <div className="resource-card-count">
                    {summary.personnel.available}
                    <span>/{summary.personnel.total}</span>
                  </div>
                  <div
                    className={`resource-card-percentage ${getStatusClass(
                      getAvailabilityPercentage(
                        summary.personnel.available,
                        summary.personnel.total,
                      ),
                    )}`}
                  >
                    {getAvailabilityPercentage(
                      summary.personnel.available,
                      summary.personnel.total,
                    )}
                    {t("resourcesPage.percentAvailable")}
                  </div>
                </div>
              </div>

              <div className="resource-items-list">
                {staffItems.map((person) => {
                  const percentage = getAvailabilityPercentage(
                    person.available,
                    person.total,
                  );
                  return (
                    <div key={person.role} className="resource-item">
                      <span className="resource-item-name">
                        {t(STAFF_ROLE_KEYS[person.role] || person.role)}
                      </span>
                      <div className="resource-item-stats">
                        <div className="resource-item-count">
                          <strong>{person.available}</strong>
                          <span>/{person.total}</span>
                          {person.deployed > 0 && (
                            <span className="deployed-badge">
                              {person.deployed} {t("resourcesPage.deployed")}
                            </span>
                          )}
                        </div>
                        <div className="progress-bar">
                          <div
                            className={`progress-bar-fill ${getStatusClass(percentage)}`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
                {staffItems.length === 0 && (
                  <div className="empty-state-small">
                    {t("resourcesPage.noPersonnelData")}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Supply Inventory Section */}
        <section className="inventory-section">
          <h2 className="section-title">
            <Package size={24} />
            {t("resourcesPage.inventory")}
          </h2>

          <div className="supply-cards-grid">
            {supplyItems.map((supply) => {
              const config = SUPPLY_CONFIG[supply.type];
              const percentage = getAvailabilityPercentage(
                supply.current,
                supply.maximum,
              );
              const isLow = supply.current < supply.minimum;
              return (
                <div
                  key={supply.type}
                  className={`supply-card ${isLow ? "low-stock" : ""}`}
                >
                  <div className="supply-card-header">
                    <span className="supply-icon">{config?.icon || "📦"}</span>
                    <h4>{t(config?.labelKey || supply.type)}</h4>
                    {isLow && (
                      <AlertTriangle size={18} className="alert-icon" />
                    )}
                  </div>
                  <div className="supply-card-body">
                    <div className="supply-big-number">
                      {supply.current}
                      <span className="supply-unit">
                        {t(config?.unitKey || "units")}
                      </span>
                    </div>
                    <div className="supply-bar-wrapper">
                      <div className="supply-bar-bg">
                        <div
                          className={`supply-bar-fill ${getStatusClass(percentage)}`}
                          style={{ width: `${Math.min(percentage, 100)}%` }}
                        />
                        {supply.minimum > 0 && (
                          <div
                            className="supply-minimum-marker"
                            style={{
                              left: `${Math.min((supply.minimum / supply.maximum) * 100, 100)}%`,
                            }}
                            title={t("resourcesPage.minimumLevel")}
                          />
                        )}
                      </div>
                    </div>
                    <div className="supply-stats-row">
                      <span>
                        {t("resourcesPage.min")}: {supply.minimum}
                      </span>
                      <span>
                        {t("resourcesPage.max")}: {supply.maximum}
                      </span>
                    </div>
                  </div>
                  {isLow && (
                    <div className="supply-warning">
                      <AlertTriangle size={14} />
                      {t("resourcesPage.belowMinimum", {
                        deficit: supply.minimum - supply.current,
                      })}
                    </div>
                  )}
                </div>
              );
            })}
            {supplyItems.length === 0 && (
              <div className="empty-state">
                <Package size={32} />
                <p>{t("resourcesPage.noSupplyData")}</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Map,
  ReportsList,
  MissionPanel,
  TriageAlertBanner,
  ResourceTracker,
  AnalyticsDashboard,
  ResourceInventory,
  NotificationBell,
  getTriageCategoryFromUrgency,
  RoadConditions,
  MissingPersons,
  ShelterManagement,
  VolunteerManagement,
} from "../components";
import { useAuth } from "../contexts";
import {
  getNeedsForMap,
  getReports,
  getMissions,
  completeMission,
  rerouteMission,
} from "../services";
import "./DashboardPage.css";

function DashboardPage() {
  const { t } = useTranslation();
  const { isManager } = useAuth();
  const [selectedReportId, setSelectedReportId] = useState(null);
  const [reroutingMissionId, setReroutingMissionId] = useState(null);
  const [activeTab, setActiveTab] = useState("map"); // "map" | "analytics" | "resources"
  const [activePanel, setActivePanel] = useState("missions"); // "missions" | "reports"
  const [isPanelOpen, setIsPanelOpen] = useState(false); // Mobile panel state
  const [sosAlerts, setSosAlerts] = useState([]);
  const [currentLocation, setCurrentLocation] = useState(null);
  const queryClient = useQueryClient();

  // Get current location for new features
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCurrentLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.log("Geolocation error:", error);
          // Default to a sample location
          setCurrentLocation({ lat: 19.076, lng: 72.8777 });
        }
      );
    }
  }, []);

  // Listen for SOS alerts broadcasted from volunteer clients
  useEffect(() => {
    const handleSosAlert = (event) => {
      const alert = event.detail;
      setSosAlerts((prev) => [alert, ...prev].slice(0, 20));
    };

    window.addEventListener("sos-alert", handleSosAlert);
    return () => window.removeEventListener("sos-alert", handleSosAlert);
  }, []);

  const {
    data: needsData = [],
    isLoading: isNeedsLoading,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["map-needs"],
    queryFn: getNeedsForMap,
    refetchInterval: 10000,
  });

  // Fetch reports
  const {
    data: reportsData = [],
    isLoading: isReportsLoading,
    refetch: refetchReports,
  } = useQuery({
    queryKey: ["reports"],
    queryFn: () => getReports({ limit: 50 }),
    refetchInterval: 5000,
  });

  // Fetch missions (auto-generated routes from logistics agent)
  const { data: missionsData = [], refetch: refetchMissions } = useQuery({
    queryKey: ["missions"],
    queryFn: getMissions,
    refetchInterval: 5000,
  });

  // Extract all routes from missions to display on map
  const missionRoutes = useMemo(() => {
    const allRoutes = [];
    (missionsData || []).forEach((mission) => {
      const stationType = mission.station?.type || "rescue";
      (mission.routes || []).forEach((routeData) => {
        if (routeData.route && routeData.route.length > 0) {
          const formattedRoute = routeData.route.map((coord) => ({
            lat: coord[0],
            lon: coord[1],
          }));
          allRoutes.push({
            vehicleId: routeData.vehicle_id,
            route: formattedRoute,
            distance: routeData.total_distance,
            stationType: routeData.station_type || stationType,
            stationName: routeData.station_name || mission.station?.name,
          });
        }
      });
    });
    return allRoutes;
  }, [missionsData]);

  const needs = useMemo(
    () =>
      (needsData || []).filter(
        (need) =>
          typeof need.lat === "number" &&
          typeof need.lon === "number" &&
          need.status !== "Completed"
      ),
    [needsData]
  );

  // Map SOS alerts to map items when location is available
  const sosMapItems = useMemo(
    () =>
      sosAlerts
        .filter((alert) => alert?.location?.lat && alert?.location?.lng)
        .map((alert) => ({
          id: `sos-${alert.timestamp}`,
          lat: alert.location.lat,
          lon: alert.location.lng,
          status: "SOS",
          category: "SOS",
          severity: 10,
          needs: ["Immediate evacuation"],
          text: alert.message || "Emergency SOS",
          isReport: false,
        })),
    [sosAlerts]
  );

  // Get analyzed reports with valid coordinates to show on map
  const analyzedReports = useMemo(
    () =>
      (reportsData || []).filter(
        (report) =>
          (report.status === "Analyzed" ||
            report.status === "Analyzed_Full" ||
            report.status === "Clustered" ||
            report.status === "InProgress") &&
          typeof report.lat === "number" &&
          typeof report.lon === "number"
      ),
    [reportsData]
  );

  // Combine needs and analyzed reports for the map
  const allMapItems = useMemo(() => {
    const reportItems = analyzedReports.map((report) => ({
      id: `report-${report.id}`,
      lat: report.lat,
      lon: report.lon,
      status: report.status === "InProgress" ? "InProgress" : "Report",
      category: report.tag || "Report",
      severity: report.severity,
      needs: report.needs,
      text: report.text || report.transcription,
      isReport: true,
    }));
    return [...needs, ...reportItems, ...sosMapItems];
  }, [needs, analyzedReports, sosMapItems]);

  const handleReportClick = (report) => {
    setSelectedReportId(report.id);
  };

  const handleCompleteMission = async (missionId) => {
    try {
      await completeMission(missionId);
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["missions"] });
      queryClient.invalidateQueries({ queryKey: ["map-needs"] });
      queryClient.invalidateQueries({ queryKey: ["reports"] });
    } catch (error) {
      console.error("Failed to complete mission:", error);
    }
  };

  // Filter reports that are already part of a mission
  const unroutedReports = useMemo(() => {
    const routedReportIds = new Set();
    (missionsData || []).forEach((mission) => {
      if (mission.reportIds && Array.isArray(mission.reportIds)) {
        mission.reportIds.forEach((id) => routedReportIds.add(id));
      }
    });

    return (reportsData || []).filter(
      (report) => !routedReportIds.has(report.id)
    );
  }, [missionsData, reportsData]);

  // Re-routing handlers
  const handleStartReroute = (missionId) => {
    setReroutingMissionId(missionId);
  };

  const handleCancelReroute = () => {
    setReroutingMissionId(null);
  };

  const handleStationClick = async (station) => {
    if (!reroutingMissionId) {
      console.log("No mission selected for re-routing");
      return;
    }

    console.log(
      "Re-routing mission",
      reroutingMissionId,
      "to station",
      station.name
    );

    try {
      await rerouteMission(reroutingMissionId, station);
      setReroutingMissionId(null);

      // The logistics agent processes rerouted needs every 5 seconds
      // Show user feedback and poll for new mission
      alert(
        `Mission re-routed to ${station.name}. The logistics agent will create a new route shortly.`
      );

      // Immediate refresh
      queryClient.invalidateQueries({ queryKey: ["missions"] });
      queryClient.invalidateQueries({ queryKey: ["map-needs"] });
      queryClient.invalidateQueries({ queryKey: ["reports"] });

      // Poll for new mission after logistics agent processes (5-10 seconds)
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["missions"] });
        queryClient.invalidateQueries({ queryKey: ["map-needs"] });
      }, 6000);
    } catch (error) {
      console.error("Failed to re-route mission:", error);
      alert(
        "Failed to re-route mission: " + (error.message || "Unknown error")
      );
    }
  };

  const handleRefreshAll = () => {
    refetch();
    refetchReports();
    refetchMissions();
  };

  // Calculate stats
  const pendingCount = allMapItems.filter(
    (item) => item.status === "Verified" || item.status === "Report"
  ).length;
  const inProgressCount = allMapItems.filter(
    (item) => item.status === "InProgress"
  ).length;

  // Calculate critical items for triage alert
  const criticalItems = allMapItems.filter((item) => {
    const category = getTriageCategoryFromUrgency(
      item.severity || item.urgency || 5
    );
    return category === "critical";
  });

  return (
    <div className="dashboard-page">
      {/* Critical Triage Alert Banner */}
      {criticalItems.length > 0 && (
        <TriageAlertBanner criticalCount={criticalItems.length} />
      )}

      {/* Compact Header Bar - Only for Managers */}
      {isManager && (
        <header className="dashboard-header dashboard-header-compact">
          <div className="header-row">
            <div className="header-title">
              <h1>
                <span className="desktop-title">{t("dashboard.title")}</span>
                <span className="mobile-title">Command Center</span>
              </h1>
              <span className="pill pill-critical">
                {criticalItems.length} critical
              </span>
            </div>

            <div className="header-actions">
              <NotificationBell />
              <button
                className="btn-refresh"
                onClick={handleRefreshAll}
                disabled={isFetching || isReportsLoading}
              >
                <span
                  className={`refresh-icon ${
                    isFetching || isReportsLoading ? "spinning" : ""
                  }`}
                ></span>
                <span>
                  {isFetching || isReportsLoading ? "Syncing" : "Refresh"}
                </span>
              </button>
            </div>
          </div>

          <div className="header-stats-row">
            <div className="stat-chip stat-total">
              <span className="stat-heading">Incidents</span>
              <span className="stat-value">{allMapItems.length}</span>
            </div>
            <div className="stat-chip stat-pending">
              <span className="stat-heading">Pending</span>
              <span className="stat-value">{pendingCount}</span>
            </div>
            <div className="stat-chip stat-active">
              <span className="stat-heading">Active</span>
              <span className="stat-value">{inProgressCount}</span>
            </div>
            <div className="stat-chip stat-missions">
              <span className="stat-heading">Missions</span>
              <span className="stat-value">{missionsData?.length || 0}</span>
            </div>
          </div>
        </header>
      )}

      <div className="dashboard-main">
        {/* Sidebar Navigation */}
        <aside className="dashboard-sidebar">
          <nav className="sidebar-nav" role="tablist">
            <button
              className={`nav-item ${activeTab === "map" ? "active" : ""}`}
              onClick={() => setActiveTab("map")}
              title="Map View"
            >
              <span className="nav-icon">🗺️</span>
              <span className="nav-label">Map</span>
            </button>
            <button
              className={`nav-item ${activeTab === "roads" ? "active" : ""}`}
              onClick={() => setActiveTab("roads")}
              title="Road Conditions"
            >
              <span className="nav-icon">🚧</span>
              <span className="nav-label">Roads</span>
            </button>
            <button
              className={`nav-item ${activeTab === "missing" ? "active" : ""}`}
              onClick={() => setActiveTab("missing")}
              title="Missing Persons"
            >
              <span className="nav-icon">🔍</span>
              <span className="nav-label">Missing</span>
            </button>
            {isManager && (
              <>
                <button
                  className={`nav-item ${
                    activeTab === "shelters" ? "active" : ""
                  }`}
                  onClick={() => setActiveTab("shelters")}
                  title="Shelters"
                >
                  <span className="nav-icon">🏠</span>
                  <span className="nav-label">Shelters</span>
                </button>
                <button
                  className={`nav-item ${
                    activeTab === "resources" ? "active" : ""
                  }`}
                  onClick={() => setActiveTab("resources")}
                  title="Resources"
                >
                  <span className="nav-icon">📦</span>
                  <span className="nav-label">Resources</span>
                </button>
                <button
                  className={`nav-item ${
                    activeTab === "analytics" ? "active" : ""
                  }`}
                  onClick={() => setActiveTab("analytics")}
                  title="Analytics"
                >
                  <span className="nav-icon">📊</span>
                  <span className="nav-label">Analytics</span>
                </button>
                <button
                  className={`nav-item ${
                    activeTab === "volunteers" ? "active" : ""
                  }`}
                  onClick={() => setActiveTab("volunteers")}
                  title="Team"
                >
                  <span className="nav-icon">👥</span>
                  <span className="nav-label">Team</span>
                </button>
              </>
            )}
          </nav>
        </aside>

        {/* Main Content Area */}
        <div className="dashboard-content-area">
          {/* Map View Content */}
          {activeTab === "map" && (
            <div className="map-view-layout">
              {/* Center - Map */}
              <main className="map-container">
                <Map
                  needs={allMapItems}
                  selectedNeedIds={new Set()}
                  onPinClick={() => {}}
                  missionRoutes={missionRoutes}
                  isRerouteMode={!!reroutingMissionId}
                  onStationClick={handleStationClick}
                />
                {(isNeedsLoading || isReportsLoading) && (
                  <div className="map-loading-overlay">
                    <div className="spinner"></div>
                    <span>Loading...</span>
                  </div>
                )}
              </main>

              {/* Bottom Panel - Missions & Reports */}
              <aside
                className={`panel panel-combined ${isPanelOpen ? "open" : ""}`}
              >
                <div
                  className="panel-toggle-handle"
                  onClick={() => setIsPanelOpen(!isPanelOpen)}
                  aria-label="Toggle panel"
                >
                  <span className="handle-bar"></span>
                </div>
                <div className="panel-tabs">
                  <button
                    className={`panel-tab ${
                      activePanel === "missions" ? "active" : ""
                    }`}
                    onClick={() => {
                      setActivePanel("missions");
                      setIsPanelOpen(true);
                    }}
                  >
                    Missions
                    <span className="tab-badge">
                      {missionsData?.length || 0}
                    </span>
                  </button>
                  <button
                    className={`panel-tab ${
                      activePanel === "reports" ? "active" : ""
                    }`}
                    onClick={() => {
                      setActivePanel("reports");
                      setIsPanelOpen(true);
                    }}
                  >
                    Reports
                    <span className="tab-badge">
                      {unroutedReports?.length || 0}
                    </span>
                  </button>
                </div>

                <div className="panel-body">
                  {activePanel === "missions" ? (
                    <MissionPanel
                      missions={missionsData || []}
                      missionRoutes={missionRoutes}
                      onCompleteMission={handleCompleteMission}
                      onStartReroute={handleStartReroute}
                      reroutingMissionId={reroutingMissionId}
                      onCancelReroute={handleCancelReroute}
                    />
                  ) : (
                    <ReportsList
                      reports={unroutedReports}
                      onReportClick={handleReportClick}
                      selectedReportId={selectedReportId}
                    />
                  )}
                </div>
              </aside>
            </div>
          )}

          {activeTab === "roads" && (
            <div className="dashboard-fullwidth">
              <RoadConditions currentLocation={currentLocation} />
            </div>
          )}

          {activeTab === "missing" && (
            <div className="dashboard-fullwidth">
              <MissingPersons currentLocation={currentLocation} />
            </div>
          )}

          {activeTab === "shelters" && isManager && (
            <div className="dashboard-fullwidth">
              <ShelterManagement currentLocation={currentLocation} />
            </div>
          )}

          {activeTab === "resources" && isManager && (
            <div className="dashboard-fullwidth">
              <ResourceTracker />
              <ResourceInventory />
            </div>
          )}

          {activeTab === "analytics" && isManager && (
            <div className="dashboard-fullwidth">
              <AnalyticsDashboard />
            </div>
          )}

          {activeTab === "volunteers" && isManager && (
            <div className="dashboard-fullwidth">
              <VolunteerManagement />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;

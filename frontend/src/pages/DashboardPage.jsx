import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Map as MapComponent,
  ReportsList,
  MissionPanel,
  TriageAlertBanner,
  ResourceTracker,
  AnalyticsDashboard,
  ResourceInventory,
  getTriageCategoryFromUrgency,
  RoadConditions,
  MissingPersons,
  ShelterManagement,
  VolunteerManagement,
} from "../components";
import { ResourcesPage } from "./index";
import { useAuth, useVolunteerRoute } from "../contexts";
import {
  getNeedsForMap,
  getReports,
  getMissions,
  completeMission,
  rerouteMission,
  getUnverifiedTasks,
  getRoadConditions,
} from "../services";
import { SYNC_COMPLETE_EVENT } from "../services/syncService";
import "./DashboardPage.css";

const severityScoreMap = {
  low: 3,
  medium: 5,
  high: 7,
  critical: 10,
};

function DashboardPage() {
  const { t } = useTranslation();
  const { isManager, isVolunteer } = useAuth();
  const {
    activeRoute,
    currentLocation: volunteerLocation,
    routeInfo,
  } = useVolunteerRoute();
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

  useEffect(() => {
    const hideTarget = () => {
      const elements = document.querySelectorAll('*');
      elements.forEach(el => {
        if (el.textContent === "Report Missing Person") {
          el.style.display = "none";
        }
      });
    };

    hideTarget();
    const observer = new MutationObserver(hideTarget);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  // Listen for sync complete events to refresh manager map when volunteers sync offline verifications
  useEffect(() => {
    if (!isManager) return;

    const handleSyncComplete = (event) => {
      const { synced } = event.detail;
      if (synced > 0) {
        console.log(
          `Sync complete: ${synced} verifications synced, refreshing map data...`
        );
        // Invalidate all map-related queries to refresh data
        queryClient.invalidateQueries({ queryKey: ["map-needs"] });
        queryClient.invalidateQueries({ queryKey: ["missions"] });
        queryClient.invalidateQueries({ queryKey: ["reports"] });
        queryClient.invalidateQueries({ queryKey: ["volunteer-tasks"] });
      }
    };

    window.addEventListener(SYNC_COMPLETE_EVENT, handleSyncComplete);
    return () =>
      window.removeEventListener(SYNC_COMPLETE_EVENT, handleSyncComplete);
  }, [isManager, queryClient]);

  // Fetch needs for map (managers see all, volunteers see only their assigned tasks)
  const {
    data: needsData = [],
    isLoading: isNeedsLoading,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["map-needs"],
    queryFn: getNeedsForMap,
    refetchInterval: 10000,
    enabled: isManager, // Only fetch for managers
  });

  // Fetch volunteer's assigned tasks (unverified tasks assigned to them)
  const { data: volunteerTasks = [] } = useQuery({
    queryKey: ["volunteer-tasks"],
    queryFn: getUnverifiedTasks,
    refetchInterval: 10000,
    enabled: isVolunteer, // Only fetch for volunteers
  });

  const { data: roadConditions = [], isLoading: isRoadConditionsLoading } =
    useQuery({
      queryKey: ["road-conditions-map"],
      queryFn: () => getRoadConditions({ status: "active" }),
      refetchInterval: 30000,
      enabled: isManager || isVolunteer,
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
    enabled: isManager, // Only fetch for managers
  });

  // Fetch missions (auto-generated routes from logistics agent)
  const { data: missionsData = [], refetch: refetchMissions } = useQuery({
    queryKey: ["missions"],
    queryFn: getMissions,
    refetchInterval: 5000,
    enabled: isManager, // Only fetch for managers
  });

  // Extract routes from missions - now pre-computed with road-snapped geometry from OSRM
  const missionRoutes = useMemo(() => {
    const allRoutes = [];
    (missionsData || []).forEach((mission) => {
      const stationType = mission.station?.type || "rescue";
      (mission.routes || []).forEach((routeData) => {
        if (routeData.route && routeData.route.length > 0) {
          // Routes now come pre-computed with road geometry from OSRM
          // Format: [[lat, lon], [lat, lon], ...] or [{lat, lon}, ...]
          const formattedRoute = routeData.route.map((coord) => {
            if (Array.isArray(coord)) {
              return { lat: coord[0], lon: coord[1] };
            }
            return { lat: coord.lat, lon: coord.lon ?? coord.lng };
          });
          allRoutes.push({
            vehicleId: routeData.vehicle_id,
            route: formattedRoute,
            distance: routeData.total_distance,
            stationType: routeData.station_type || stationType,
            stationName: routeData.station_name || mission.station?.name,
            missionId: mission._id,
            isRoadSnapped: routeData.is_road_snapped ?? true,
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
          need.status !== "Completed" &&
          need.emergencyStatus !== "resolved" // Exclude resolved emergencies
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
          typeof report.lon === "number" &&
          report.emergencyStatus !== "resolved" // Exclude resolved emergencies
      ),
    [reportsData]
  );

  // Convert volunteer tasks to map items (for volunteer mode)
  const volunteerMapItems = useMemo(() => {
    return (volunteerTasks || [])
      .filter(
        (task) => typeof task.lat === "number" && typeof task.lon === "number"
      )
      .map((task) => ({
        id: task.id,
        lat: task.lat,
        lon: task.lon,
        status: task.status || "Unverified",
        category: task.needType || "Task",
        severity: task.urgency || 5,
        needs: [],
        text: task.description || task.notes || "Assigned task",
        isReport: false,
        isTask: true,
      }));
  }, [volunteerTasks]);

  const roadConditionMapItems = useMemo(() => {
    return (roadConditions || [])
      .filter(
        (condition) =>
          typeof condition?.startPoint?.lat === "number" &&
          typeof condition?.startPoint?.lng === "number"
      )
      .map((condition) => ({
        id: condition.conditionId || condition._id,
        lat: condition.startPoint.lat,
        lon: condition.startPoint.lng,
        status: "Report",
        category: condition.conditionType || "Road",
        severity: severityScoreMap[condition.severity] ?? 5,
        needs: condition.roadName ? [condition.roadName] : [],
        text: condition.description,
        description: condition.description,
        isReport: true,
      }));
  }, [roadConditions]);

  // Combine needs and analyzed reports for the map (manager view)
  const allMapItems = useMemo(() => {
    // For volunteers, only show their assigned tasks
    if (isVolunteer) {
      return [...volunteerMapItems, ...roadConditionMapItems];
    }
    // For managers, show all needs, reports, and SOS alerts
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
    return [...needs, ...reportItems, ...sosMapItems, ...roadConditionMapItems];
  }, [
    needs,
    analyzedReports,
    sosMapItems,
    roadConditionMapItems,
    isVolunteer,
    volunteerMapItems,
  ]);

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
                <span className="mobile-title">{t("dashboard.title")}</span>
              </h1>
              <span className="pill pill-critical">
                {criticalItems.length} {t("triage.critical").toLowerCase()}
              </span>
            </div>

            <div className="header-actions">
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
                  {isFetching || isReportsLoading
                    ? t("dashboard.syncing")
                    : t("dashboard.refresh")}
                </span>
              </button>
            </div>
          </div>

          <div className="header-stats-row">
            <div className="stat-chip stat-total">
              <span className="stat-heading">
                {t("dashboard.totalIncidents")}
              </span>
              <span className="stat-value">{allMapItems.length}</span>
            </div>
            <div className="stat-chip stat-pending">
              <span className="stat-heading">{t("dashboard.pending")}</span>
              <span className="stat-value">{pendingCount}</span>
            </div>
            <div className="stat-chip stat-active">
              <span className="stat-heading">{t("dashboard.inProgress")}</span>
              <span className="stat-value">{inProgressCount}</span>
            </div>
            <div className="stat-chip stat-missions">
              <span className="stat-heading">{t("missions.title")}</span>
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
              title={t("nav.map")}
            >
              <span className="nav-icon">🗺️</span>
              <span className="nav-label">{t("nav.map")}</span>
            </button>
            <button
              className={`nav-item ${activeTab === "roads" ? "active" : ""}`}
              onClick={() => setActiveTab("roads")}
              title={t("nav.roads")}
            >
              <span className="nav-icon">🚧</span>
              <span className="nav-label">{t("nav.roads")}</span>
            </button>
            <button
              className={`nav-item ${activeTab === "missing" ? "active" : ""}`}
              onClick={() => setActiveTab("missing")}
              title={t("nav.missing")}
            >
              <span className="nav-icon">🔍</span>
              <span className="nav-label">{t("nav.missing")}</span>
            </button>
            {isManager && (
              <>
                <button
                  className={`nav-item ${
                    activeTab === "shelters" ? "active" : ""
                  }`}
                  onClick={() => setActiveTab("shelters")}
                  title={t("nav.shelters")}
                >
                  <span className="nav-icon">🏠</span>
                  <span className="nav-label">{t("nav.shelters")}</span>
                </button>
                <button
                  className={`nav-item ${
                    activeTab === "resources" ? "active" : ""
                  }`}
                  onClick={() => setActiveTab("resources")}
                  title={t("nav.resources")}
                >
                  <span className="nav-icon">📦</span>
                  <span className="nav-label">{t("nav.resources")}</span>
                </button>
                <button
                  className={`nav-item ${
                    activeTab === "analytics" ? "active" : ""
                  }`}
                  onClick={() => setActiveTab("analytics")}
                  title={t("nav.analytics")}
                >
                  <span className="nav-icon">📊</span>
                  <span className="nav-label">{t("nav.analytics")}</span>
                </button>
                <button
                  className={`nav-item ${
                    activeTab === "volunteers" ? "active" : ""
                  }`}
                  onClick={() => setActiveTab("volunteers")}
                  title={t("nav.team")}
                >
                  <span className="nav-icon">👥</span>
                  <span className="nav-label">{t("nav.team")}</span>
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
                <MapComponent
                  needs={allMapItems}
                  selectedNeedIds={new Set()}
                  onPinClick={() => {}}
                  missionRoutes={missionRoutes}
                  isRerouteMode={!!reroutingMissionId}
                  onStationClick={handleStationClick}
                  volunteerMode={isVolunteer}
                  volunteerLocation={volunteerLocation}
                  volunteerRoute={activeRoute}
                  isRouteFallback={routeInfo?.isFallback || false}
                />
                {(isNeedsLoading ||
                  isReportsLoading ||
                  isRoadConditionsLoading) &&
                  !isVolunteer && (
                  <div className="map-loading-overlay">
                    <div className="spinner"></div>
                    <span>{t("common.loading")}</span>
                  </div>
                )}
              </main>

              {/* Bottom Panel - Missions & Reports (Only for managers) */}
              {isManager && (
                <aside
                  className={`panel panel-combined ${
                    isPanelOpen ? "open" : ""
                  }`}
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
                      {t("missions.title")}
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
                      {t("missions.reports")}
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
              )}
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
            <div className="dashboard-fullwidth" style={{ padding: 0 }}>
              <ResourcesPage />
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

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
  rerouteRejectedReport,
  getUnverifiedTasks,
  getRoadConditions,
  getShelters,
} from "../services";
import { SYNC_COMPLETE_EVENT } from "../services/syncService";
import {
  MapIcon,
  Construction,
  Search,
  Home,
  Package,
  BarChart3,
  Users,
} from "lucide-react";
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
  const [reroutingReportId, setReroutingReportId] = useState(null);
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
          // Default to a sample location
          setCurrentLocation({ lat: 19.076, lng: 72.8777 });
        },
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
      const elements = document.querySelectorAll("*");
      elements.forEach((el) => {
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

  // Fetch shelters for map markers (visible to all authenticated roles)
  const { data: sheltersData = [] } = useQuery({
    queryKey: ["shelters-map"],
    queryFn: () => getShelters(),
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
          need.emergencyStatus !== "resolved", // Exclude resolved emergencies
      ),
    [needsData],
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
    [sosAlerts],
  );

  // Get analyzed reports with valid coordinates to show on map
  // Include Analyzed_Visual status so photo reports appear on map immediately after Sentinel analysis
  const analyzedReports = useMemo(
    () =>
      (reportsData || []).filter(
        (report) =>
          (report.status === "Analyzed" ||
            report.status === "Analyzed_Full" ||
            report.status === "Analyzed_Visual" ||
            report.status === "Clustered" ||
            report.status === "InProgress") &&
          typeof report.lat === "number" &&
          typeof report.lon === "number" &&
          report.emergencyStatus !== "resolved", // Exclude resolved emergencies
      ),
    [reportsData],
  );

  // Convert volunteer tasks to map items (for volunteer mode)
  const volunteerMapItems = useMemo(() => {
    return (volunteerTasks || [])
      .filter(
        (task) => typeof task.lat === "number" && typeof task.lon === "number",
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
          typeof condition?.startPoint?.lng === "number",
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
      rawId: report.id,
      lat: report.lat,
      lon: report.lon,
      status: report.status === "InProgress" ? "InProgress" : "Report",
      category: report.tag || "Report",
      severity: report.severity,
      needs: report.needs,
      text: report.text || report.transcription,
      isReport: true,
      emergencyStatus: report.emergencyStatus || "none",
      emergencyType: report.emergencyType || "general",
      assignedStation: report.assignedStation,
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

  // Handle clicking a rejected pin on the map to start rerouting
  const handlePinClick = (needId) => {
    const item = allMapItems.find((n) => n.id === needId);
    if (item && item.emergencyStatus === "rejected") {
      // Enter reroute mode for this rejected report/need
      const idToReroute = item.rawId || item.id;
      setReroutingReportId(idToReroute);
      setReroutingMissionId(null); // Cancel any mission reroute
    }
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
      (report) => !routedReportIds.has(report.id),
    );
  }, [missionsData, reportsData]);

  // Re-routing handlers
  const handleStartReroute = (missionId) => {
    setReroutingMissionId(missionId);
    setReroutingReportId(null); // Cancel any report reroute
  };

  const handleCancelReroute = () => {
    setReroutingMissionId(null);
    setReroutingReportId(null);
  };

  // Start rerouting for a rejected report from the ReportsList
  const handleStartReportReroute = (reportId) => {
    setReroutingReportId(reportId);
    setReroutingMissionId(null); // Cancel any mission reroute
  };

  const handleStationClick = async (station) => {
    // Handle rejected report/need rerouting
    if (reroutingReportId) {
      try {
        await rerouteRejectedReport(reroutingReportId, station);
        setReroutingReportId(null);

        alert(t("mission.rerouteSuccess", { name: station.name }));

        // Immediate refresh
        queryClient.invalidateQueries({ queryKey: ["missions"] });
        queryClient.invalidateQueries({ queryKey: ["map-needs"] });
        queryClient.invalidateQueries({ queryKey: ["reports"] });

        // Poll for update after logistics agent processes
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ["missions"] });
          queryClient.invalidateQueries({ queryKey: ["map-needs"] });
          queryClient.invalidateQueries({ queryKey: ["reports"] });
        }, 6000);
      } catch (error) {
        console.error("Failed to reroute rejected report:", error);
        alert(
          t("mission.rerouteFailed") +
            ": " +
            (error.message || t("common.unknownError")),
        );
      }
      return;
    }

    // Handle mission rerouting
    if (!reroutingMissionId) {
      return;
    }

    try {
      await rerouteMission(reroutingMissionId, station);
      setReroutingMissionId(null);

      // The logistics agent processes rerouted needs every 5 seconds
      // Show user feedback and poll for new mission
      alert(t("mission.rerouteSuccess", { name: station.name }));

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
        t("mission.rerouteFailed") +
          ": " +
          (error.message || t("common.unknownError")),
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
    (item) => item.status === "Verified" || item.status === "Report",
  ).length;
  const inProgressCount = allMapItems.filter(
    (item) => item.status === "InProgress",
  ).length;

  // Calculate critical items for triage alert
  const criticalItems = allMapItems.filter((item) => {
    const category = getTriageCategoryFromUrgency(
      item.severity || item.urgency || 5,
    );
    return category === "critical";
  });

  // Build tabs list based on role
  const tabs = [
    { id: "map", icon: MapIcon, label: t("nav.map") },
    { id: "roads", icon: Construction, label: t("nav.roads") },
    { id: "missing", icon: Search, label: t("nav.missing") },
    ...(isManager
      ? [
          { id: "shelters", icon: Home, label: t("nav.shelters") },
          { id: "resources", icon: Package, label: t("nav.resources") },
          { id: "analytics", icon: BarChart3, label: t("nav.analytics") },
          { id: "volunteers", icon: Users, label: t("nav.team") },
        ]
      : []),
  ];

  return (
    <div className="dashboard-page">
      {/* Critical Triage Alert Banner */}
      {criticalItems.length > 0 && (
        <TriageAlertBanner criticalCount={criticalItems.length} />
      )}

      {/* Clean Top Bar — title + stats + refresh */}
      {isManager && (
        <header className="dash-topbar">
          <div className="topbar-left">
            <h1 className="topbar-title">{t("dashboard.title")}</h1>
            {criticalItems.length > 0 && (
              <span className="topbar-badge topbar-badge--danger">
                {criticalItems.length} {t("triage.critical").toLowerCase()}
              </span>
            )}
          </div>

          <div className="topbar-stats">
            <div className="topbar-stat">
              <span className="topbar-stat__value">{allMapItems.length}</span>
              <span className="topbar-stat__label">
                {t("dashboard.totalIncidents")}
              </span>
            </div>
            <div className="topbar-stat topbar-stat--pending">
              <span className="topbar-stat__value">{pendingCount}</span>
              <span className="topbar-stat__label">
                {t("dashboard.pending")}
              </span>
            </div>
            <div className="topbar-stat topbar-stat--active">
              <span className="topbar-stat__value">{inProgressCount}</span>
              <span className="topbar-stat__label">
                {t("dashboard.inProgress")}
              </span>
            </div>
            <div className="topbar-stat topbar-stat--missions">
              <span className="topbar-stat__value">
                {missionsData?.length || 0}
              </span>
              <span className="topbar-stat__label">{t("missions.title")}</span>
            </div>
          </div>

          <button
            className="topbar-refresh"
            onClick={handleRefreshAll}
            disabled={isFetching || isReportsLoading}
            title={t("dashboard.refresh")}
          >
            <span
              className={`topbar-refresh__icon ${isFetching || isReportsLoading ? "spinning" : ""}`}
            />
            <span className="topbar-refresh__text">
              {isFetching || isReportsLoading
                ? t("dashboard.syncing")
                : t("dashboard.refresh")}
            </span>
          </button>
        </header>
      )}

      {/* Sidebar + Content wrapper */}
      <div className="dash-body">
        {/* Vertical Sidebar Tab Navigation */}
        <nav className="dash-tabs" role="tablist">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`dash-tab ${activeTab === tab.id ? "dash-tab--active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
              role="tab"
              aria-selected={activeTab === tab.id}
              title={tab.label}
            >
              <tab.icon size={17} className="dash-tab__icon" />
              <span className="dash-tab__label">{tab.label}</span>
            </button>
          ))}
        </nav>

        {/* Content Area */}
        <div className="dash-content">
          {/* Map View */}
          {activeTab === "map" && (
            <div className="dash-map-layout">
              <main className="dash-map">
                <MapComponent
                  needs={allMapItems}
                  selectedNeedIds={new Set()}
                  onPinClick={handlePinClick}
                  missionRoutes={missionRoutes}
                  isRerouteMode={!!reroutingMissionId || !!reroutingReportId}
                  onStationClick={handleStationClick}
                  volunteerMode={isVolunteer}
                  volunteerLocation={volunteerLocation}
                  volunteerRoute={activeRoute}
                  isRouteFallback={routeInfo?.isFallback || false}
                  shelters={sheltersData}
                />
                {/* Reroute mode banner for rejected reports */}
                {reroutingReportId && (
                  <div className="dash-reroute-banner">
                    <span>
                      🔄 {t("reports.rerouteMode", "Click a station on the map to reroute this rejected alert")}
                    </span>
                    <button onClick={handleCancelReroute}>
                      ✕ {t("common.cancel", "Cancel")}
                    </button>
                  </div>
                )}
                {(isNeedsLoading ||
                  isReportsLoading ||
                  isRoadConditionsLoading) &&
                  !isVolunteer && (
                    <div className="dash-map__loading">
                      <div className="spinner" />
                      <span>{t("common.loading")}</span>
                    </div>
                  )}
              </main>

              {/* Side Panel — Missions & Reports (managers only) */}
              {isManager && (
                <aside
                  className={`dash-panel ${isPanelOpen ? "dash-panel--open" : ""}`}
                >
                  <div
                    className="dash-panel__handle"
                    onClick={() => setIsPanelOpen(!isPanelOpen)}
                    aria-label="Toggle panel"
                  >
                    <span className="handle-bar" />
                  </div>

                  <div className="dash-panel__tabs">
                    <button
                      className={`dash-panel__tab ${activePanel === "missions" ? "dash-panel__tab--active" : ""}`}
                      onClick={() => {
                        setActivePanel("missions");
                        setIsPanelOpen(true);
                      }}
                    >
                      {t("missions.title")}
                      <span className="dash-panel__badge">
                        {missionsData?.length || 0}
                      </span>
                    </button>
                    <button
                      className={`dash-panel__tab ${activePanel === "reports" ? "dash-panel__tab--active" : ""}`}
                      onClick={() => {
                        setActivePanel("reports");
                        setIsPanelOpen(true);
                      }}
                    >
                      {t("missions.reports")}
                      <span className="dash-panel__badge">
                        {unroutedReports?.length || 0}
                      </span>
                    </button>
                  </div>

                  <div className="dash-panel__body">
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
                        onRerouteReport={handleStartReportReroute}
                        reroutingReportId={reroutingReportId}
                      />
                    )}
                  </div>
                </aside>
              )}
            </div>
          )}

          {activeTab === "roads" && (
            <div className="dash-fullpage">
              <RoadConditions currentLocation={currentLocation} />
            </div>
          )}

          {activeTab === "missing" && (
            <div className="dash-fullpage">
              <MissingPersons currentLocation={currentLocation} />
            </div>
          )}

          {activeTab === "shelters" && isManager && (
            <div className="dash-fullpage">
              <ShelterManagement currentLocation={currentLocation} />
            </div>
          )}

          {activeTab === "resources" && isManager && (
            <div className="dash-fullpage" style={{ padding: 0 }}>
              <ResourcesPage />
            </div>
          )}

          {activeTab === "analytics" && isManager && (
            <div className="dash-fullpage">
              <AnalyticsDashboard />
            </div>
          )}

          {activeTab === "volunteers" && isManager && (
            <div className="dash-fullpage">
              <VolunteerManagement />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;

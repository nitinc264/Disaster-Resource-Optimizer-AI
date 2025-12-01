import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Map, ReportsList, MissionPanel } from "../components";
import {
  getNeedsForMap,
  getReports,
  getMissions,
  completeMission,
  rerouteMission,
} from "../services";
import "./DashboardPage.css";

function DashboardPage() {
  const [selectedReportId, setSelectedReportId] = useState(null);
  const [reroutingMissionId, setReroutingMissionId] = useState(null);
  const queryClient = useQueryClient();

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
    return [...needs, ...reportItems];
  }, [needs, analyzedReports]);

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

  return (
    <div className="dashboard-page">
      {/* Top Header Bar */}
      <header className="dashboard-header">
        <div className="header-left">
          <h1>Command Center</h1>
          <span className="header-subtitle">
            Live resource tracking and mission monitoring
          </span>
        </div>

        {/* Stats Bar */}
        <div className="stats-bar">
          <div className="stat-chip">
            <span className="stat-icon">📍</span>
            <div className="stat-content">
              <span className="stat-value">{allMapItems.length}</span>
              <span className="stat-label">Total Incidents</span>
            </div>
          </div>
          <div className="stat-chip stat-pending">
            <span className="stat-icon">⏳</span>
            <div className="stat-content">
              <span className="stat-value">{pendingCount}</span>
              <span className="stat-label">Pending</span>
            </div>
          </div>
          <div className="stat-chip stat-active">
            <span className="stat-icon">🚀</span>
            <div className="stat-content">
              <span className="stat-value">{inProgressCount}</span>
              <span className="stat-label">In Progress</span>
            </div>
          </div>
          <div className="stat-chip stat-missions">
            <span className="stat-icon">🚒</span>
            <div className="stat-content">
              <span className="stat-value">{missionsData?.length || 0}</span>
              <span className="stat-label">Active Missions</span>
            </div>
          </div>
        </div>

        <div className="header-actions">
          <button
            className="btn-refresh"
            onClick={handleRefreshAll}
            disabled={isFetching || isReportsLoading}
          >
            <span className="refresh-icon">
              {isFetching || isReportsLoading ? "⟳" : "↻"}
            </span>
            {isFetching || isReportsLoading ? "Syncing..." : "Refresh"}
          </button>
        </div>
      </header>

      {/* Main Content - 3 Column Layout */}
      <div className="dashboard-content">
        {/* Left Panel - Missions */}
        <aside className="panel panel-left">
          <div className="panel-header">
            <h2>Active Missions</h2>
            <span className="panel-badge">{missionsData?.length || 0}</span>
          </div>
          <div className="panel-body">
            <MissionPanel
              missions={missionsData || []}
              missionRoutes={missionRoutes}
              onCompleteMission={handleCompleteMission}
              onStartReroute={handleStartReroute}
              reroutingMissionId={reroutingMissionId}
              onCancelReroute={handleCancelReroute}
            />
          </div>
        </aside>

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
              <span>Loading map data...</span>
            </div>
          )}
        </main>

        {/* Right Panel - Reports */}
        <aside className="panel panel-right">
          <div className="panel-header">
            <h2>Incoming Reports</h2>
            <span className="panel-badge">{reportsData?.length || 0}</span>
          </div>
          <div className="panel-body">
            <ReportsList
              reports={reportsData}
              onReportClick={handleReportClick}
              selectedReportId={selectedReportId}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}

export default DashboardPage;

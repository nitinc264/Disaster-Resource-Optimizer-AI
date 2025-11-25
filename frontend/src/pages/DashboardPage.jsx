import React, { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Map } from "../components";
import { optimizeRoute, getNeedsForMap } from "../services";
import "./DashboardPage.css";

const DEPOT_LOCATION = { lat: 18.521, lon: 73.854 };

function DashboardPage() {
  const [selectedNeedIds, setSelectedNeedIds] = useState(new Set());
  const [optimizedRoute, setOptimizedRoute] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const {
    data: needsData = [],
    isLoading: isNeedsLoading,
    error: needsError,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["map-needs"],
    queryFn: getNeedsForMap,
    refetchInterval: 10000,
  });

  const needs = useMemo(
    () =>
      (needsData || []).filter(
        (need) => typeof need.lat === "number" && typeof need.lon === "number"
      ),
    [needsData]
  );

  const optimizeLabel =
    selectedNeedIds.size > 0
      ? `Optimize ${selectedNeedIds.size} Stops`
      : "Select stops on map";

  useEffect(() => {
    setSelectedNeedIds((prev) => {
      const next = new Set();
      prev.forEach((id) => {
        const stillValid = needs.find(
          (need) => need.id === id && need.status === "Verified"
        );
        if (stillValid) {
          next.add(id);
        }
      });
      return next;
    });
  }, [needs]);

  const handleMarkerClick = (needId) => {
    const need = needs.find((n) => n.id === needId);
    if (!need || need.status !== "Verified") return;

    setSelectedNeedIds((prev) => {
      const next = new Set(prev);
      if (next.has(needId)) {
        next.delete(needId);
      } else {
        next.add(needId);
      }
      return next;
    });
  };

  const handleOptimize = async () => {
    if (selectedNeedIds.size === 0) return;

    setIsLoading(true);
    setError(null);
    try {
      const selectedNeeds = needs.filter((n) => selectedNeedIds.has(n.id));
      const stops = selectedNeeds.map((n) => ({ lat: n.lat, lon: n.lon }));
      const response = await optimizeRoute({ depot: DEPOT_LOCATION, stops });
      setOptimizedRoute(response.data?.optimized_route || []);
    } catch (err) {
      console.error("Optimization failed:", err);
      setError("Failed to calculate optimal route. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearSelection = () => {
    setSelectedNeedIds(new Set());
    setOptimizedRoute([]);
    setError(null);
  };

  return (
    <div className="dashboard-page">
      <div className="dashboard-header">
        <div className="header-title">
          <h1>Command Center</h1>
          <p>Live resource tracking and route optimization.</p>
        </div>
        <div className="header-controls">
          <button
            className="btn-secondary"
            onClick={refetch}
            disabled={isFetching}
          >
            {isFetching ? "Syncing..." : "Refresh Data"}
          </button>
        </div>
      </div>

      <div className="dashboard-grid">
        <aside className="control-panel">
          <div className="panel-section">
            <h3>Route Optimizer</h3>
            <p className="panel-desc">
              Select verified pins on the map to build a delivery route.
            </p>

            <div className="stats-grid">
              <div className="stat-item">
                <span className="stat-value">{needs.length}</span>
                <span className="stat-label">Total Needs</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">{selectedNeedIds.size}</span>
                <span className="stat-label">Selected</span>
              </div>
            </div>

            <div className="action-group">
              <button
                className={`btn-primary ${
                  selectedNeedIds.size === 0 ? "disabled" : ""
                }`}
                onClick={handleOptimize}
                disabled={selectedNeedIds.size === 0 || isLoading}
              >
                {isLoading ? "Calculating..." : optimizeLabel}
              </button>

              {selectedNeedIds.size > 0 && (
                <button className="btn-text" onClick={handleClearSelection}>
                  Clear Selection
                </button>
              )}
            </div>

            {error && <div className="error-message">{error}</div>}
          </div>

          {optimizedRoute.length > 0 && (
            <div className="panel-section route-results">
              <h3>Optimized Route</h3>
              <div className="route-timeline">
                {optimizedRoute.map((stop, index) => (
                  <div key={index} className="timeline-item">
                    <div className="timeline-marker">{index + 1}</div>
                    <div className="timeline-content">
                      <span className="stop-name">
                        {stop.category || "Depot"}
                      </span>
                      <span className="stop-details">
                        {stop.lat.toFixed(4)}, {stop.lon.toFixed(4)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>

        <main className="map-container">
          <Map
            needs={needs}
            selectedNeedIds={selectedNeedIds}
            onPinClick={handleMarkerClick}
            optimizedRoute={optimizedRoute}
            depot={DEPOT_LOCATION}
          />
          {isNeedsLoading && (
            <div className="map-loading-overlay">
              <div className="spinner"></div>
              <span>Loading map data...</span>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default DashboardPage;

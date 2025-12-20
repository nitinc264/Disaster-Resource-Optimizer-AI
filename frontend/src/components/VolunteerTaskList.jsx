import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  Navigation,
  X,
  Loader2,
  MapPin,
  CheckCircle2,
  ChevronRight,
  FileText,
  CloudOff,
  RefreshCw,
} from "lucide-react";
import { getUnverifiedTasks, verifyTask } from "../services";
import {
  SYNC_COMPLETE_EVENT,
  getPendingVerificationCount,
  syncPendingVerifications,
} from "../services/syncService";
import { useVolunteerRoute, useAuth } from "../contexts";
import "./VolunteerTaskList.css";

// Format distance in meters/km
const formatDistance = (meters) => {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
};

// Format duration in seconds to minutes/hours
const formatDuration = (seconds) => {
  if (seconds < 60) return `${Math.round(seconds)} sec`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
  const hours = Math.floor(seconds / 3600);
  const mins = Math.round((seconds % 3600) / 60);
  return `${hours}h ${mins}m`;
};

// Truncate task ID for display
const truncateId = (id) => {
  if (!id) return "";
  return id.length > 8 ? `${id.slice(-6)}` : id;
};

export default function VolunteerTaskList() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isVolunteer } = useAuth();
  const [verifyingTasks, setVerifyingTasks] = useState(new Set());
  const [offlinePendingTasks, setOfflinePendingTasks] = useState(new Set());
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [expandedTask, setExpandedTask] = useState(null);
  const {
    activeTask,
    startRoute,
    cancelRoute,
    currentLocation,
    hasActiveRoute,
    routeInfo,
    isLoadingRoute,
  } = useVolunteerRoute();

  // Fetch tasks using react-query for caching
  const {
    data: tasks,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["unverifiedTasks"],
    queryFn: getUnverifiedTasks,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: true,
  });

  // Update pending count on mount and when tasks change
  useEffect(() => {
    const updatePendingCount = async () => {
      const count = await getPendingVerificationCount();
      setPendingCount(count);
    };
    updatePendingCount();
  }, [offlinePendingTasks]);

  // Handle verify button click
  const handleVerify = async (task, e) => {
    e.stopPropagation();
    setVerifyingTasks((prev) => new Set(prev).add(task.id));

    try {
      const result = await verifyTask(task);
      if (result.status === "offline-pending") {
        // Mark task as pending sync
        setOfflinePendingTasks((prev) => new Set(prev).add(task.id));
        // Update pending count
        const count = await getPendingVerificationCount();
        setPendingCount(count);
      } else {
        refetch();
      }
    } catch (error) {
      console.error("Error verifying task:", error);
    } finally {
      setVerifyingTasks((prev) => {
        const newSet = new Set(prev);
        newSet.delete(task.id);
        return newSet;
      });
    }
  };

  // Manual sync trigger
  const handleManualSync = async () => {
    if (!navigator.onLine || isSyncing) return;

    setIsSyncing(true);
    try {
      await syncPendingVerifications();
    } finally {
      setIsSyncing(false);
    }
  };

  // Listen for online/offline events and sync completion
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      refetch();
    };
    const handleOffline = () => setIsOnline(false);

    const handleSyncComplete = async (event) => {
      const { synced } = event.detail;
      if (synced > 0) {
        // Clear offline pending tasks and refetch
        setOfflinePendingTasks(new Set());
        const count = await getPendingVerificationCount();
        setPendingCount(count);
        refetch();
        // Also invalidate map-needs for managers viewing the map
        queryClient.invalidateQueries({ queryKey: ["map-needs"] });
        queryClient.invalidateQueries({ queryKey: ["volunteer-tasks"] });
      }
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener(SYNC_COMPLETE_EVENT, handleSyncComplete);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener(SYNC_COMPLETE_EVENT, handleSyncComplete);
    };
  }, [refetch, queryClient]);

  if (isLoading) {
    return (
      <div className="task-list-container">
        <div className="task-loading">
          <Loader2 size={24} className="spin" />
          <span>{t("taskList.loading")}</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="task-list-container">
        <div className="task-error">
          <AlertTriangle size={20} />
          <span>{t("taskList.error")}</span>
        </div>
      </div>
    );
  }

  const handleStartRoute = async (task, e) => {
    e.stopPropagation();

    // Check if task has coordinates
    if (!task.lat || !task.lon) {
      alert(t("tasks.noLocation"));
      return;
    }

    // Start the route (location is already verified at login)
    const success = await startRoute(task);

    // If route started successfully, redirect to map
    if (success) {
      navigate("/dashboard");
    }
  };

  const hasCoordinates = (task) => {
    return typeof task.lat === "number" && typeof task.lon === "number";
  };

  const toggleExpand = (taskId) => {
    setExpandedTask(expandedTask === taskId ? null : taskId);
  };

  return (
    <div className="task-list-container">
      <div className="task-list-header">
        <h2>{t("taskList.title")}</h2>
        <span className="task-count">{tasks?.length || 0}</span>
      </div>

      {!isOnline && (
        <div className="offline-banner">
          <AlertTriangle size={14} />
          <span>{t("taskList.offline")}</span>
        </div>
      )}

      {/* Pending Sync Banner */}
      {pendingCount > 0 && (
        <div className="pending-sync-banner">
          <CloudOff size={14} />
          <span>
            {pendingCount}{" "}
            {pendingCount === 1 ? "verification" : "verifications"} pending sync
          </span>
          {isOnline && (
            <button
              className="sync-btn"
              onClick={handleManualSync}
              disabled={isSyncing}
            >
              <RefreshCw size={14} className={isSyncing ? "spin" : ""} />
              {isSyncing ? "Syncing..." : "Sync Now"}
            </button>
          )}
        </div>
      )}

      {/* Active Route Banner */}
      {hasActiveRoute && activeTask && (
        <div className="active-route-banner">
          <Navigation size={18} className="route-icon" />
          <div className="route-details">
            <span className="route-status">{t("taskList.navigating")}</span>
            {routeInfo && routeInfo.distance && (
              <span className="route-eta">
                {formatDistance(routeInfo.distance)} •{" "}
                {formatDuration(routeInfo.duration)}
              </span>
            )}
          </div>
          <button className="cancel-route" onClick={cancelRoute} title="Cancel">
            <X size={18} />
          </button>
        </div>
      )}

      {tasks && tasks.length === 0 ? (
        <div className="empty-state">
          <CheckCircle2 size={40} strokeWidth={1.5} />
          <p>{t("taskList.empty")}</p>
          <span>{t("taskList.emptyHint")}</span>
        </div>
      ) : (
        <div className="task-cards">
          {tasks?.map((task) => {
            const isVerifying = verifyingTasks.has(task.id);
            const isPendingSync = offlinePendingTasks.has(task.id);
            const isActiveTask = activeTask && activeTask.id === task.id;
            const isLoadingThisRoute =
              isLoadingRoute && activeTask?.id === task.id;
            const canStartRoute =
              hasCoordinates(task) &&
              currentLocation &&
              !isActiveTask &&
              !isLoadingRoute;
            const isExpanded = expandedTask === task.id;

            return (
              <div
                key={task.id}
                className={`task-card ${isVerifying ? "verifying" : ""} ${
                  isActiveTask ? "active" : ""
                } ${isExpanded ? "expanded" : ""} ${
                  isPendingSync ? "pending-sync" : ""
                }`}
                onClick={() => toggleExpand(task.id)}
              >
                <div className="task-card-main">
                  <div className="task-info">
                    <p className="task-description">
                      {task.description || t("taskList.noDescription")}
                    </p>
                    <div className="task-meta">
                      <span className="task-location">
                        <MapPin size={12} />
                        {task.location || t("taskList.locationPending")}
                      </span>
                      {isPendingSync && (
                        <span className="pending-badge">
                          <CloudOff size={10} /> Pending Sync
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight
                    size={18}
                    className={`expand-icon ${isExpanded ? "rotated" : ""}`}
                  />
                </div>

                {isExpanded && (
                  <div className="task-card-expanded">
                    {task.notes && task.notes !== task.location && (
                      <div className="task-notes">
                        <FileText size={12} />
                        <span>{task.notes}</span>
                      </div>
                    )}

                    <div className="task-id">ID: {task.id}</div>

                    <div className="task-actions">
                      {isVolunteer && hasCoordinates(task) && (
                        <button
                          onClick={(e) => handleStartRoute(task, e)}
                          disabled={!canStartRoute}
                          className={`btn-route ${
                            isActiveTask ? "active" : ""
                          }`}
                        >
                          {isLoadingThisRoute ? (
                            <Loader2 size={14} className="spin" />
                          ) : (
                            <Navigation size={14} />
                          )}
                          {isActiveTask
                            ? t("taskList.navigatingBtn")
                            : t("taskList.startRoute")}
                        </button>
                      )}

                      <button
                        onClick={(e) => handleVerify(task, e)}
                        disabled={isVerifying}
                        className="btn-verify"
                      >
                        {isVerifying ? (
                          <Loader2 size={14} className="spin" />
                        ) : (
                          <CheckCircle2 size={14} />
                        )}
                        {isVerifying
                          ? t("taskList.verifying")
                          : t("taskList.verify")}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

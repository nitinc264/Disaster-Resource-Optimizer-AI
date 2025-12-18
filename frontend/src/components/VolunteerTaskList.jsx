import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { AlertTriangle } from "lucide-react";
import { getUnverifiedTasks, verifyTask } from "../services";
import "./VolunteerTaskList.css";

export default function VolunteerTaskList() {
  const { t } = useTranslation();
  const [verifyingTasks, setVerifyingTasks] = useState(new Set());
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Fetch tasks using react-query for caching
  const {
    data: tasks,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["unverifiedTasks"],
    queryFn: getUnverifiedTasks,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes (renamed from cacheTime in v5)
    refetchOnWindowFocus: true,
  });

  // Handle verify button click
  const handleVerify = async (task) => {
    setVerifyingTasks((prev) => new Set(prev).add(task.id));

    try {
      const result = await verifyTask(task);

      if (result.status === "offline-pending") {
        // Task queued for sync
      } else {
        // Refetch tasks to update the list
        refetch();
      }
    } catch (error) {
      console.error("Error verifying task:", error);
      // Remove from verifying set on error
      setVerifyingTasks((prev) => {
        const newSet = new Set(prev);
        newSet.delete(task.id);
        return newSet;
      });
    }
  };

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Refetch tasks when back online
      refetch();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [refetch]);

  if (isLoading) {
    return <div className="task-list-container">{t("tasks.loading")}</div>;
  }

  if (error) {
    return (
      <div className="task-list-container error-message">
        {t("tasks.errorLoading")}: {error.message}
      </div>
    );
  }

  return (
    <div className="task-list-container">
      <h2>{t("tasks.title")}</h2>

      {!isOnline && (
        <div className="task-list-offline-banner">
          <AlertTriangle size={16} className="icon-inline" />{" "}
          {t("tasks.offlineBanner")}
        </div>
      )}

      {tasks && tasks.length === 0 ? (
        <p className="task-list-empty">{t("tasks.empty")}</p>
      ) : (
        <ul className="task-list">
          {tasks?.map((task) => {
            const isVerifying = verifyingTasks.has(task.id);

            return (
              <li
                key={task.id}
                className={`task-item ${isVerifying ? "verifying" : ""}`}
              >
                <div className="task-field">
                  <strong>{t("tasks.taskId")}:</strong> {task.id}
                </div>
                <div className="task-field">
                  <strong>{t("tasks.description")}:</strong>{" "}
                  {task.description || t("tasks.noDescription")}
                </div>
                <div className="task-field">
                  <strong>{t("tasks.notes")}:</strong>{" "}
                  {task.notes || t("tasks.noNotes")}
                </div>

                <button
                  onClick={() => handleVerify(task)}
                  disabled={isVerifying}
                  className="task-verify-button"
                >
                  {isVerifying && !isOnline
                    ? t("tasks.pendingSync")
                    : isVerifying
                    ? t("tasks.verifying")
                    : t("tasks.verify")}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

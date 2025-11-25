import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { getUnverifiedTasks, verifyTask } from "../services";
import "./VolunteerTaskList.css";

export default function VolunteerTaskList() {
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
    return <div className="task-list-container">Loading tasks...</div>;
  }

  if (error) {
    return (
      <div className="task-list-container error-message">
        Error loading tasks: {error.message}
      </div>
    );
  }

  return (
    <div className="task-list-container">
      <h2>Unverified Tasks</h2>

      {!isOnline && (
        <div className="task-list-offline-banner">
          <AlertTriangle size={16} className="icon-inline" /> You are offline.
          Verifications will be synced when you reconnect.
        </div>
      )}

      {tasks && tasks.length === 0 ? (
        <p className="task-list-empty">No unverified tasks available.</p>
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
                  <strong>Task ID:</strong> {task.id}
                </div>
                <div className="task-field">
                  <strong>Description:</strong>{" "}
                  {task.description || "No description"}
                </div>
                <div className="task-field">
                  <strong>Notes:</strong> {task.notes || "No notes"}
                </div>

                <button
                  onClick={() => handleVerify(task)}
                  disabled={isVerifying}
                  className="task-verify-button"
                >
                  {isVerifying && !isOnline
                    ? "Pending Sync"
                    : isVerifying
                    ? "Verifying..."
                    : "Verify"}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

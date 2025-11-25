import { useSyncManager } from "../hooks";
import { Upload } from "lucide-react";
import "./SyncStatus.css";

/**
 * Component to display pending sync status
 */
export default function SyncStatus() {
  const { pendingTasks, syncPendingTasks } = useSyncManager();

  if (pendingTasks.length === 0) {
    return null;
  }

  return (
    <div className="sync-status-container">
      <span>
        <Upload size={16} className="icon-inline" /> {pendingTasks.length}{" "}
        verification
        {pendingTasks.length !== 1 ? "s" : ""} pending sync
      </span>
      {navigator.onLine && (
        <button onClick={syncPendingTasks} className="sync-status-button">
          Sync Now
        </button>
      )}
    </div>
  );
}

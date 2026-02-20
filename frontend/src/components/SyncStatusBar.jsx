import { useState, useEffect } from "react";
import { useOffline } from "../contexts/OfflineContext";
import { useTranslation } from "react-i18next";
import "./SyncStatusBar.css";

/**
 * SyncStatusBar
 * A fixed bar at the bottom of the screen that shows:
 * - "You are offline" when there is no connectivity
 * - Pending changes count + manual "Sync Now" button
 * - Sync-in-progress spinner
 * - Brief success / failure toast after sync
 */
export default function SyncStatusBar() {
  const { t } = useTranslation();
  const {
    isOnline,
    pendingCount,
    failedCount,
    syncing,
    lastSyncResult,
    triggerSync,
  } = useOffline();

  // Show success toast for a few seconds then auto-dismiss
  const [dismissed, setDismissed] = useState(false);

  // Reset dismissed flag whenever sync result changes
  useEffect(() => {
    if (lastSyncResult) setDismissed(false);

    // Auto-dismiss success messages after 5 seconds
    if (lastSyncResult && lastSyncResult.failed === 0 && lastSyncResult.synced > 0) {
      const timer = setTimeout(() => setDismissed(true), 5000);
      return () => clearTimeout(timer);
    }
  }, [lastSyncResult]);

  // Determine what state to render
  const hasPending = pendingCount > 0;
  const hasFailed = failedCount > 0;
  const showSuccessToast =
    lastSyncResult &&
    lastSyncResult.synced > 0 &&
    lastSyncResult.failed === 0 &&
    !dismissed;

  // Decide visibility
  const visible = !isOnline || syncing || hasPending || hasFailed || showSuccessToast;

  // Pick variant class
  let variant = "hidden";
  if (!isOnline) variant = "offline";
  else if (syncing) variant = "syncing";
  else if (hasFailed) variant = "failed";
  else if (hasPending) variant = "pending";
  else if (showSuccessToast) variant = "success";

  return (
    <div
      className={`SyncStatusBar SyncStatusBar--${variant} ${
        !visible ? "SyncStatusBar--hidden" : ""
      }`}
      role="status"
      aria-live="polite"
    >
      {/* ---- Info section ---- */}
      <div className="SyncStatusBar-info">
        <span className="SyncStatusBar-icon">{_icon(variant)}</span>
        <span className="SyncStatusBar-text">{_message(variant, { pendingCount, failedCount, lastSyncResult, t })}</span>
      </div>

      {/* ---- Actions ---- */}
      <div className="SyncStatusBar-actions">
        {syncing && <span className="SyncStatusBar-spinner" />}

        {/* Sync Now button — show when online with pending/failed items */}
        {isOnline && (hasPending || hasFailed) && !syncing && (
          <button
            className="SyncStatusBar-btn"
            onClick={triggerSync}
            disabled={syncing}
          >
            {t("sync.syncNow", "Sync Now")}
          </button>
        )}

        {/* Dismiss button for success toasts */}
        {showSuccessToast && (
          <button
            className="SyncStatusBar-dismiss"
            onClick={() => setDismissed(true)}
            aria-label={t("common.dismiss", "Dismiss")}
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}

// ---- helpers ----

function _icon(variant) {
  switch (variant) {
    case "offline":
      return "⚡";
    case "syncing":
      return "🔄";
    case "pending":
      return "📦";
    case "failed":
      return "⚠️";
    case "success":
      return "✅";
    default:
      return "";
  }
}

function _message(variant, { pendingCount, failedCount, lastSyncResult, t }) {
  switch (variant) {
    case "offline":
      return t(
        "sync.offline",
        "You are offline. Changes will be saved locally and synced when you reconnect."
      );
    case "syncing":
      return t("sync.syncing", "Synchronizing changes with server…");
    case "pending":
      return t("sync.pending", "{{count}} change(s) waiting to sync.", {
        count: pendingCount,
      });
    case "failed":
      return t(
        "sync.failed",
        "{{count}} change(s) failed to sync. You can retry manually.",
        { count: failedCount }
      );
    case "success":
      return t("sync.success", "{{count}} change(s) synced successfully!", {
        count: lastSyncResult?.synced || 0,
      });
    default:
      return "";
  }
}

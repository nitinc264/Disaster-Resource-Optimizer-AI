import { useState } from "react";
import { useTranslation } from "react-i18next";
import "./ReportsList.css";

const STATUS_COLORS = {
  Pending: "#f59e0b",
  Processing_Audio: "#3b82f6",
  Processing_Visual: "#3b82f6",
  Pending_Transcription: "#8b5cf6",
  Analyzed: "#10b981",
  Analyzed_Visual: "#22c55e",
  Analyzed_Full: "#10b981",
  Clustered: "#8b5cf6",
  Resolved: "#6b7280",
  Error: "#ef4444",
};

const SEVERITY_LABEL_KEYS = {
  1: "reports.severity.veryLow",
  2: "reports.severity.low",
  3: "reports.severity.low",
  4: "reports.severity.mediumLow",
  5: "reports.severity.medium",
  6: "reports.severity.mediumHigh",
  7: "reports.severity.high",
  8: "reports.severity.high",
  9: "reports.severity.critical",
  10: "reports.severity.emergency",
};

const EMERGENCY_STATUS_COLORS = {
  none: null,
  pending: "#10b981",
  assigned: "#eab308",
  dispatched: "#f97316",
  rejected: "#ef4444",
  resolved: "#6b7280",
};

function ReportsList({ reports, onReportClick, selectedReportId, onRerouteReport, reroutingReportId }) {
  const { t } = useTranslation();
  const [expandedReportId, setExpandedReportId] = useState(null);

  const toggleExpand = (reportId) => {
    setExpandedReportId(expandedReportId === reportId ? null : reportId);
  };

  if (!reports || reports.length === 0) {
    return (
      <div className="reports-list-empty">
        <div className="empty-icon">📋</div>
        <p>{t("reports.empty")}</p>
        <span>{t("reports.emptyHint")}</span>
      </div>
    );
  }

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);

    if (diffMins < 1) return t("reports.justNow");
    if (diffMins < 60) return t("reports.minutesAgo", { count: diffMins });
    if (diffHours < 24) return t("reports.hoursAgo", { count: diffHours });
    return date.toLocaleDateString();
  };

  const getSeverityClass = (severity) => {
    if (severity >= 8) return "severity-critical";
    if (severity >= 6) return "severity-high";
    if (severity >= 4) return "severity-medium";
    return "severity-low";
  };

  return (
    <div className="reports-list">
      {reports.map((report) => {
        const isExpanded = expandedReportId === report.id;
        return (
          <div
            key={report.id}
            className={`report-card ${
              selectedReportId === report.id ? "selected" : ""
            } ${isExpanded ? "expanded" : ""} ${
              (report.status === "Analyzed" ||
                report.status === "Analyzed_Full") &&
              report.lat
                ? "clickable"
                : ""
            }`}
            onClick={() => {
              toggleExpand(report.id);
              if (
                (report.status === "Analyzed" ||
                  report.status === "Analyzed_Full") &&
                report.lat
              ) {
                onReportClick?.(report);
              }
            }}
          >
            <div className="report-header">
              <div className="report-header-top">
                <span
                  className="report-status"
                  style={{
                    backgroundColor: STATUS_COLORS[report.status] || "#6b7280",
                  }}
                >
                  {report.status.replace(/_/g, " ")}
                </span>
                {report.emergencyStatus === "rejected" && (
                  <span
                    className="report-status report-status--rejected"
                    style={{ backgroundColor: "#ef4444" }}
                  >
                    {t("reports.rejected", "Rejected")}
                  </span>
                )}
                <span className="report-time">
                  {formatTime(report.createdAt)}
                </span>
              </div>
              {!isExpanded && (
                <div className="report-preview">
                  <span className="report-source">{report.source}</span>
                  <span className="report-preview-text">
                    {report.text
                      ? report.text.substring(0, 40) +
                        (report.text.length > 40 ? "..." : "")
                      : report.transcription
                        ? "🎤 " +
                          report.transcription.substring(0, 40) +
                          (report.transcription.length > 40 ? "..." : "")
                        : t("reports.processing")}
                  </span>
                </div>
              )}
            </div>

            {isExpanded && (
              <div className="report-body">
                <div className="report-meta-row">
                  <span className="report-source">{report.source}</span>
                </div>
                <div className="report-content">
                  {report.text ? (
                    <p className="report-text">{report.text}</p>
                  ) : report.transcription ? (
                    <p className="report-text transcription">
                      <span className="transcription-label">🎤 </span>
                      {report.transcription}
                    </p>
                  ) : (
                    <p className="report-text pending">
                      {t("reports.processing")}
                    </p>
                  )}
                </div>

                {(report.status === "Analyzed" ||
                  report.status === "Analyzed_Full") && (
                  <div className="report-analysis">
                    {report.tag && (
                      <span className="report-tag">{report.tag}</span>
                    )}
                    {report.severity && (
                      <span
                        className={`report-severity ${getSeverityClass(
                          report.severity,
                        )}`}
                      >
                        {SEVERITY_LABEL_KEYS[report.severity]
                          ? t(SEVERITY_LABEL_KEYS[report.severity])
                          : `Level ${report.severity}`}
                      </span>
                    )}
                    {report.needs && report.needs.length > 0 && (
                      <div className="report-needs">
                        {report.needs.map((need, idx) => (
                          <span key={idx} className="need-badge">
                            {need}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {report.lat && report.lon && (
                  <div className="report-location">
                    <span className="location-icon">📍</span>
                    <span className="location-coords">
                      {report.lat.toFixed(4)}, {report.lon.toFixed(4)}
                    </span>
                  </div>
                )}

                {/* Emergency status badge */}
                {report.emergencyStatus && report.emergencyStatus !== "none" && (
                  <div className="report-emergency-status">
                    <span
                      className="emergency-status-badge"
                      style={{
                        color: EMERGENCY_STATUS_COLORS[report.emergencyStatus] || "#6b7280",
                      }}
                    >
                      🚨{" "}
                      {report.emergencyStatus === "rejected"
                        ? t("reports.rejectedByStation", "Rejected by Station")
                        : report.emergencyStatus.charAt(0).toUpperCase() +
                          report.emergencyStatus.slice(1)}
                    </span>
                    {report.assignedStation?.stationName && (
                      <span className="emergency-station-name">
                        📍 {report.assignedStation.stationName}
                      </span>
                    )}
                    {report.emergencyStatus === "rejected" &&
                      report.assignedStation?.rejectionReason && (
                        <span className="emergency-rejection-reason" style={{ color: "#ef4444" }}>
                          {t("reports.reason", "Reason")}: {report.assignedStation.rejectionReason}
                        </span>
                      )}
                  </div>
                )}

                {/* Reroute button for rejected reports */}
                {report.emergencyStatus === "rejected" && onRerouteReport && (
                  <button
                    className={`btn-reroute-report ${
                      reroutingReportId === report.reportId ? "active" : ""
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onRerouteReport(report.reportId);
                    }}
                  >
                    {reroutingReportId === report.reportId
                      ? `⏳ ${t("reports.selectStation", "Select a station on map...")}`
                      : `🔄 ${t("reports.rerouteToStation", "Reroute to Station")}`}
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default ReportsList;

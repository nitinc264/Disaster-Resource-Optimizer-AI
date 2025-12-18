import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  X,
  MapPin,
  Clock,
  CheckCircle,
  AlertCircle,
  Car,
  Droplets,
  Construction,
  Trash2,
  ThumbsUp,
  ChevronDown,
  ChevronUp,
  Plus,
  RefreshCw,
  Navigation,
} from "lucide-react";
import { roadConditionsAPI } from "../services/apiService";
import "./RoadConditions.css";

const ConditionTypeIcon = ({ type }) => {
  switch (type) {
    case "flooded":
      return <Droplets size={16} />;
    case "blocked":
      return <AlertCircle size={16} />;
    case "damaged":
      return <Construction size={16} />;
    case "debris":
      return <Trash2 size={16} />;
    case "accident":
      return <Car size={16} />;
    default:
      return <AlertTriangle size={16} />;
  }
};

const SeverityBadge = ({ severity }) => {
  const colors = {
    low: "severity-low",
    medium: "severity-medium",
    high: "severity-high",
    critical: "severity-critical",
  };

  return (
    <span className={`severity-badge ${colors[severity] || "severity-medium"}`}>
      {severity}
    </span>
  );
};

const RoadConditionCard = ({ condition, onVerify, onResolve }) => {
  const [expanded, setExpanded] = useState(false);
  const { t } = useTranslation();

  const timeAgo = (date) => {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  return (
    <div
      className={`road-condition-card ${condition.severity} ${
        expanded ? "expanded" : ""
      }`}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="condition-header">
        <div className="condition-main-info">
          <div className="condition-type-badge">
            <ConditionTypeIcon type={condition.conditionType} />
            <span>{condition.conditionType}</span>
          </div>
          <span className="condition-time">
            {timeAgo(condition.reportedAt || condition.createdAt)}
          </span>
        </div>

        <div className="condition-summary">
          <span className="condition-location-text">
            {condition.description || "Road condition reported"}
          </span>
          <SeverityBadge severity={condition.severity} />
        </div>
      </div>

      {expanded && (
        <div className="condition-body">
          <div className="condition-details-grid">
            <div className="detail-item">
              <span className="detail-label">Location</span>
              <div className="detail-value">
                <MapPin size={14} />
                <span>
                  {condition.startPoint?.address || "Location coordinates"}
                </span>
              </div>
            </div>

            {condition.affectedDistance && (
              <div className="detail-item">
                <span className="detail-label">Affected Area</span>
                <div className="detail-value">
                  <span>{condition.affectedDistance}m</span>
                </div>
              </div>
            )}

            <div className="detail-item">
              <span className="detail-label">Verification</span>
              <div className="detail-value">
                <ThumbsUp size={14} />
                <span>{condition.verification?.count || 0} verified</span>
              </div>
            </div>
          </div>

          <div className="condition-actions">
            <button
              className="btn-verify"
              onClick={(e) => {
                e.stopPropagation();
                onVerify(condition._id);
              }}
            >
              <CheckCircle size={14} />
              Verify
            </button>
            <button
              className="btn-resolve"
              onClick={(e) => {
                e.stopPropagation();
                onResolve(condition._id);
              }}
            >
              <Navigation size={14} />
              Mark Cleared
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const ReportConditionForm = ({ onSubmit, onCancel, currentLocation }) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    conditionType: "blocked",
    severity: "medium",
    description: "",
    useCurrentLocation: true,
  });

  const handleSubmit = (e) => {
    e.preventDefault();

    const report = {
      conditionType: formData.conditionType,
      severity: formData.severity,
      description: formData.description,
      startPoint: {
        type: "Point",
        coordinates: currentLocation
          ? [currentLocation.lng, currentLocation.lat]
          : [0, 0],
      },
    };

    onSubmit(report);
  };

  return (
    <form className="report-condition-form" onSubmit={handleSubmit}>
      <h4>Report Road Condition</h4>

      <div className="form-group">
        <label>Condition Type</label>
        <select
          value={formData.conditionType}
          onChange={(e) =>
            setFormData({ ...formData, conditionType: e.target.value })
          }
        >
          <option value="blocked">Blocked Road</option>
          <option value="flooded">Flooded Road</option>
          <option value="damaged">Damaged Road</option>
          <option value="debris">Debris on Road</option>
          <option value="accident">Accident</option>
        </select>
      </div>

      <div className="form-group">
        <label>Severity</label>
        <div className="severity-options">
          {["low", "medium", "high", "critical"].map((level) => (
            <button
              key={level}
              type="button"
              className={`severity-option ${
                formData.severity === level ? "selected" : ""
              } ${level}`}
              onClick={() => setFormData({ ...formData, severity: level })}
            >
              {level}
            </button>
          ))}
        </div>
      </div>

      <div className="form-group">
        <label>Description</label>
        <textarea
          value={formData.description}
          onChange={(e) =>
            setFormData({ ...formData, description: e.target.value })
          }
          placeholder="Describe the road condition..."
          rows={3}
        />
      </div>

      <div className="form-group location-info">
        <MapPin size={14} />
        <span>
          {currentLocation
            ? `Using your location: ${currentLocation.lat.toFixed(
                5
              )}, ${currentLocation.lng.toFixed(5)}`
            : "Location not available"}
        </span>
      </div>

      <div className="form-actions">
        <button type="button" className="btn-cancel" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="submit"
          className="btn-submit"
          disabled={!currentLocation}
        >
          <AlertTriangle size={14} />
          Report Condition
        </button>
      </div>
    </form>
  );
};

export default function RoadConditions({ currentLocation, onConditionClick }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [showReportForm, setShowReportForm] = useState(false);
  const [filter, setFilter] = useState("all");

  // Fetch road conditions
  const {
    data: conditions,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["roadConditions", filter],
    queryFn: () =>
      roadConditionsAPI.getAll({
        status: filter !== "all" ? filter : undefined,
      }),
    select: (response) => response?.data?.data || [],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data) => roadConditionsAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(["roadConditions"]);
      setShowReportForm(false);
    },
  });

  // Verify mutation
  const verifyMutation = useMutation({
    mutationFn: (id) => roadConditionsAPI.verify(id),
    onSuccess: () => {
      queryClient.invalidateQueries(["roadConditions"]);
    },
  });

  // Resolve mutation
  const resolveMutation = useMutation({
    mutationFn: (id) => roadConditionsAPI.resolve(id),
    onSuccess: () => {
      queryClient.invalidateQueries(["roadConditions"]);
    },
  });

  const handleReportSubmit = (data) => {
    createMutation.mutate(data);
  };

  const activeConditions =
    conditions?.filter((c) => c.status === "active") || [];
  const criticalCount = activeConditions.filter(
    (c) => c.severity === "critical" || c.severity === "high"
  ).length;

  return (
    <div className="road-conditions-panel">
      <div className="panel-header">
        <div className="header-title">
          <AlertTriangle size={20} />
          <h3>Road Conditions</h3>
          {criticalCount > 0 && (
            <span className="critical-badge">{criticalCount} critical</span>
          )}
        </div>
        <div className="header-actions">
          <button
            className="btn-refresh"
            onClick={() => refetch()}
            title="Refresh"
          >
            <RefreshCw size={16} />
          </button>
          <button
            className="btn-report"
            onClick={() => setShowReportForm(!showReportForm)}
          >
            {showReportForm ? <X size={16} /> : <Plus size={16} />}
            {showReportForm ? "Cancel" : "Report"}
          </button>
        </div>
      </div>

      {showReportForm && (
        <ReportConditionForm
          onSubmit={handleReportSubmit}
          onCancel={() => setShowReportForm(false)}
          currentLocation={currentLocation}
        />
      )}

      <div className="filter-tabs">
        {["all", "active", "verified", "resolved"].map((f) => (
          <button
            key={f}
            className={`filter-tab ${filter === f ? "active" : ""}`}
            onClick={() => setFilter(f)}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      <div className="conditions-list">
        {isLoading ? (
          <div className="loading-state">
            <RefreshCw className="spin" size={20} />
            <span>Loading conditions...</span>
          </div>
        ) : activeConditions.length === 0 ? (
          <div className="empty-state">
            <CheckCircle size={32} />
            <p>No road conditions reported</p>
            <span>All roads appear to be clear</span>
          </div>
        ) : (
          conditions.map((condition) => (
            <RoadConditionCard
              key={condition._id}
              condition={condition}
              onVerify={(id) => verifyMutation.mutate(id)}
              onResolve={(id) => resolveMutation.mutate(id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

import { useState, useCallback, useEffect } from "react";
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
  ChevronDown,
  ChevronUp,
  Plus,
  RefreshCw,
  Navigation,
  Shield,
  Loader2,
} from "lucide-react";
import { roadConditionsAPI } from "../services/apiService";
import Modal from "./Modal";
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

const RoadConditionCard = ({ condition, onResolve, onVerify, isVerifying }) => {
  const [expanded, setExpanded] = useState(false);
  const { t } = useTranslation();

  const timeAgo = (date) => {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const getConditionTypeLabel = (type) => {
    const typeKeys = {
      blocked: "roads.blocked",
      flooded: "roads.flooded",
      damaged: "roads.damaged",
      debris: "roads.debris",
      accident: "roads.accident",
    };
    return t(typeKeys[type] || type);
  };

  return (
    <div
      className={`road-condition-card ${condition.severity} ${
        expanded ? "expanded" : ""
      } ${condition.verified ? "verified" : ""}`}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="condition-header">
        <div className="condition-main-info">
          <div className="condition-type-badge">
            <ConditionTypeIcon type={condition.conditionType} />
            <span>{getConditionTypeLabel(condition.conditionType)}</span>
            {condition.verified && (
              <span className="verified-badge">
                <CheckCircle size={12} />
              </span>
            )}
          </div>
          <span className="condition-time">
            {timeAgo(condition.reportedAt || condition.createdAt)}
          </span>
        </div>

        <div className="condition-summary">
          <span className="condition-location-text">
            {condition.description || t("roads.title")}
          </span>
          <SeverityBadge severity={condition.severity} />
        </div>
      </div>

      {expanded && (
        <div className="condition-body">
          <div className="condition-details-grid">
            <div className="detail-item">
              <span className="detail-label">{t("roads.location")}</span>
              <div className="detail-value">
                <MapPin size={14} />
                <span>
                  {condition.startPoint?.address || t("tasks.location")}
                </span>
              </div>
            </div>

            {condition.affectedDistance && (
              <div className="detail-item">
                <span className="detail-label">{t("roads.affectedArea")}</span>
                <div className="detail-value">
                  <span>{condition.affectedDistance}m</span>
                </div>
              </div>
            )}

          </div>

          <div className="condition-actions">
            {!condition.verified && (
              <button
                className="btn-verify"
                onClick={(e) => {
                  e.stopPropagation();
                  onVerify(condition.conditionId || condition._id);
                }}
                disabled={isVerifying}
              >
                {isVerifying ? <Loader2 size={14} className="spin" /> : <Shield size={14} />}
                {t("roads.verify")}
              </button>
            )}
            <button
              className="btn-resolve"
              onClick={(e) => {
                e.stopPropagation();
                onResolve(condition.conditionId || condition._id);
              }}
            >
              <Navigation size={14} />
              {t("roads.markCleared")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// Default fallback location (Pune, India)
const DEFAULT_LOCATION = { lat: 18.5204, lng: 73.8567 };

const ReportConditionForm = ({ onSubmit, onCancel, currentLocation: externalLocation, isSubmitting }) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    conditionType: "blocked",
    severity: "medium",
    description: "",
  });
  const [location, setLocation] = useState(externalLocation || null);
  const [locationStatus, setLocationStatus] = useState("idle"); // idle, loading, success, error
  const [locationError, setLocationError] = useState(null);

  // Fetch location when form opens
  useEffect(() => {
    // If external location is provided, use it
    if (externalLocation?.lat && externalLocation?.lng) {
      setLocation(externalLocation);
      setLocationStatus("success");
      return;
    }

    // Otherwise, try to fetch location
    fetchLocation();
  }, [externalLocation]);

  const fetchLocation = () => {
    if (!navigator.geolocation) {
      setLocationStatus("error");
      setLocationError("Geolocation not supported");
      setLocation(DEFAULT_LOCATION);
      return;
    }

    setLocationStatus("loading");
    setLocationError(null);

    const timeoutId = setTimeout(() => {
      // If location takes too long, use default
      setLocationStatus("error");
      setLocationError("Location timeout - using default");
      setLocation(DEFAULT_LOCATION);
    }, 10000); // 10 second timeout

    navigator.geolocation.getCurrentPosition(
      (position) => {
        clearTimeout(timeoutId);
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setLocationStatus("success");
        setLocationError(null);
      },
      (error) => {
        clearTimeout(timeoutId);
        console.warn("Geolocation error:", error.message);
        setLocationStatus("error");
        setLocationError(error.message);
        setLocation(DEFAULT_LOCATION); // Use fallback
      },
      {
        enableHighAccuracy: false, // Faster response
        timeout: 8000,
        maximumAge: 60000, // Cache for 1 minute
      }
    );
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const finalLocation = location || DEFAULT_LOCATION;

    const report = {
      conditionType: formData.conditionType,
      severity: formData.severity,
      description: formData.description,
      // Backend expects simple lat/lng fields, not GeoJSON
      startPoint: {
        lat: finalLocation.lat,
        lng: finalLocation.lng,
      },
      endPoint: {
        lat: finalLocation.lat,
        lng: finalLocation.lng,
      },
    };

    onSubmit(report);
  };

  return (
    <form className="report-condition-form" onSubmit={handleSubmit}>
      <h4>{t("roads.reportCondition")}</h4>

      <div className="form-group">
        <label>{t("roads.conditionType")}</label>
        <select
          value={formData.conditionType}
          onChange={(e) =>
            setFormData({ ...formData, conditionType: e.target.value })
          }
        >
          <option value="blocked">{t("roads.blocked")}</option>
          <option value="flooded">{t("roads.flooded")}</option>
          <option value="damaged">{t("roads.damaged")}</option>
          <option value="debris">{t("roads.debris")}</option>
          <option value="accident">{t("roads.accident")}</option>
        </select>
      </div>

      <div className="form-group">
        <label>{t("roads.severity")}</label>
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
              {t(`reports.severity.${level}`, level)}
            </button>
          ))}
        </div>
      </div>

      <div className="form-group">
        <label>{t("roads.description")} *</label>
        <textarea
          value={formData.description}
          onChange={(e) =>
            setFormData({ ...formData, description: e.target.value })
          }
          placeholder={t("roads.description")}
          rows={3}
          required
        />
      </div>

      <div className={`form-group location-info ${locationStatus}`}>
        {locationStatus === "loading" ? (
          <Loader2 size={14} className="spin" />
        ) : (
          <MapPin size={14} />
        )}
        <span>
          {locationStatus === "loading" && "Fetching location..."}
          {locationStatus === "success" && location &&
            `${t("tasks.location")}: ${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`}
          {locationStatus === "error" && (
            <>
              {locationError || "Location unavailable"} - using default location
            </>
          )}
          {locationStatus === "idle" && "Waiting for location..."}
        </span>
        {locationStatus === "error" && (
          <button
            type="button"
            className="btn-retry-location"
            onClick={(e) => {
              e.preventDefault();
              fetchLocation();
            }}
          >
            <RefreshCw size={12} />
          </button>
        )}
      </div>

      <div className="form-actions">
        <button type="button" className="btn-cancel" onClick={onCancel}>
          {t("common.cancel")}
        </button>
        <button
          type="submit"
          className="btn-submit"
          disabled={!formData.description.trim() || isSubmitting || locationStatus === "loading"}
        >
          <AlertTriangle size={14} />
          {isSubmitting ? t("common.loading") : t("roads.reportBtn")}
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
  const invalidateRoadQueries = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["roadConditions"] });
    queryClient.invalidateQueries({ queryKey: ["road-conditions-map"] });
  }, [queryClient]);

  // Fetch road conditions
  const {
    data: conditions,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["roadConditions", filter],
    queryFn: () =>
      roadConditionsAPI.getAll({
        // For "verified" filter, fetch all and filter client-side by verified field
        // For other filters, use status parameter
        status: filter === "verified" ? undefined : (filter !== "all" ? filter : undefined),
      }),
    select: (response) => {
      const data = response?.data?.data || [];
      // Client-side filter for verified tab
      if (filter === "verified") {
        return data.filter((c) => c.verified === true);
      }
      return data;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data) => roadConditionsAPI.create(data),
    onSuccess: () => {
      invalidateRoadQueries();
      setShowReportForm(false);
    },
    onError: (error) => {
      console.error("Failed to report condition:", error);
      const message = error?.response?.data?.message || error.message || "Failed to submit report";
      alert(message);
    },
  });

  // Resolve mutation
  const resolveMutation = useMutation({
    mutationFn: (id) => roadConditionsAPI.resolve(id),
    onSuccess: () => {
      invalidateRoadQueries();
    },
  });

  // Verify mutation
  const verifyMutation = useMutation({
    mutationFn: (id) => roadConditionsAPI.verify(id),
    onSuccess: () => {
      invalidateRoadQueries();
    },
    onError: (error) => {
      console.error("Failed to verify condition:", error);
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
          <h3>{t("roads.title")}</h3>
          {criticalCount > 0 && (
            <span className="critical-badge">
              {criticalCount} {t("triage.critical")}
            </span>
          )}
        </div>
        <div className="header-actions">
          <button
            className="btn-refresh"
            onClick={() => refetch()}
            title={t("resources.refresh")}
          >
            <RefreshCw size={16} />
          </button>
          <button
            className="btn-report"
            onClick={() => setShowReportForm(!showReportForm)}
          >
            {showReportForm ? <X size={16} /> : <Plus size={16} />}
            {showReportForm ? t("common.cancel") : t("roads.report")}
          </button>
        </div>
      </div>

      <Modal
        isOpen={showReportForm}
        onClose={() => setShowReportForm(false)}
        title={t("roads.reportCondition")}
        hideFooter
      >
        <ReportConditionForm
          onSubmit={handleReportSubmit}
          onCancel={() => setShowReportForm(false)}
          currentLocation={currentLocation}
          isSubmitting={createMutation.isPending}
        />
      </Modal>

      <div className="filter-tabs">
        {["all", "active", "verified"].map((f) => (
          <button
            key={f}
            className={`filter-tab ${filter === f ? "active" : ""}`}
            onClick={() => setFilter(f)}
          >
            {t(`roads.filter${f.charAt(0).toUpperCase() + f.slice(1)}`)}
          </button>
        ))}
      </div>

      <div className="conditions-list">
        {isLoading ? (
          <div className="loading-state">
            <RefreshCw className="spin" size={20} />
            <span>{t("common.loading")}</span>
          </div>
        ) : activeConditions.length === 0 ? (
          <div className="empty-state">
            <CheckCircle size={32} />
            <p>{t("roads.noReports")}</p>
            <span>{t("roads.noReportsHint")}</span>
          </div>
        ) : (
          conditions.map((condition) => (
            <RoadConditionCard
              key={condition.conditionId || condition._id}
              condition={condition}
              onResolve={(id) => resolveMutation.mutate(id)}
              onVerify={(id) => verifyMutation.mutate(id)}
              isVerifying={verifyMutation.isPending}
            />
          ))
        )}
      </div>
    </div>
  );
}

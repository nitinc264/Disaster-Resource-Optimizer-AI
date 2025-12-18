import { useTranslation } from "react-i18next";
import { AlertTriangle, AlertCircle, Clock, CheckCircle } from "lucide-react";
import "./TriageBadge.css";

/**
 * Triage categories with color coding and icons
 */
export const TRIAGE_CATEGORIES = {
  CRITICAL: {
    key: "critical",
    minSeverity: 9,
    color: "#dc2626",
    bgColor: "#fef2f2",
    borderColor: "#fecaca",
    icon: AlertTriangle,
    pulse: true,
  },
  URGENT: {
    key: "urgent",
    minSeverity: 7,
    color: "#ea580c",
    bgColor: "#fff7ed",
    borderColor: "#fed7aa",
    icon: AlertCircle,
    pulse: false,
  },
  STANDARD: {
    key: "standard",
    minSeverity: 4,
    color: "#ca8a04",
    bgColor: "#fefce8",
    borderColor: "#fef08a",
    icon: Clock,
    pulse: false,
  },
  LOW: {
    key: "low",
    minSeverity: 1,
    color: "#16a34a",
    bgColor: "#f0fdf4",
    borderColor: "#bbf7d0",
    icon: CheckCircle,
    pulse: false,
  },
};

/**
 * Get triage category based on severity score
 */
export function getTriageCategory(severity) {
  if (severity >= TRIAGE_CATEGORIES.CRITICAL.minSeverity)
    return TRIAGE_CATEGORIES.CRITICAL;
  if (severity >= TRIAGE_CATEGORIES.URGENT.minSeverity)
    return TRIAGE_CATEGORIES.URGENT;
  if (severity >= TRIAGE_CATEGORIES.STANDARD.minSeverity)
    return TRIAGE_CATEGORIES.STANDARD;
  return TRIAGE_CATEGORIES.LOW;
}

/**
 * Get triage category from urgency (string or number)
 */
export function getTriageCategoryFromUrgency(urgency) {
  // Handle numeric severity/urgency
  if (typeof urgency === "number") {
    return getTriageCategory(urgency);
  }

  // Handle string urgency
  switch (urgency?.toLowerCase?.()) {
    case "high":
    case "critical":
      return TRIAGE_CATEGORIES.CRITICAL;
    case "medium":
    case "urgent":
      return TRIAGE_CATEGORIES.URGENT;
    case "low":
      return TRIAGE_CATEGORIES.LOW;
    default:
      return TRIAGE_CATEGORIES.STANDARD;
  }
}

/**
 * Triage Badge Component
 */
export function TriageBadge({
  severity,
  urgency,
  size = "default",
  showLabel = true,
}) {
  const { t } = useTranslation();

  // Determine category from severity (numeric) or urgency (string)
  const category = severity
    ? getTriageCategory(severity)
    : getTriageCategoryFromUrgency(urgency);

  const Icon = category.icon;
  const iconSize = size === "small" ? 12 : size === "large" ? 20 : 14;

  return (
    <span
      className={`triage-badge triage-${category.key} ${
        category.pulse ? "pulse" : ""
      } size-${size}`}
      style={{
        "--triage-color": category.color,
        "--triage-bg": category.bgColor,
        "--triage-border": category.borderColor,
      }}
    >
      <Icon size={iconSize} />
      {showLabel && (
        <span className="triage-label">{t(`triage.${category.key}`)}</span>
      )}
    </span>
  );
}

// Keep default export for compatibility
export default TriageBadge;

/**
 * Triage Alert Banner - for critical incidents
 */
export function TriageAlertBanner({ count, onViewAll }) {
  const { t } = useTranslation();

  if (count === 0) return null;

  return (
    <div className="triage-alert-banner">
      <div className="triage-alert-content">
        <AlertTriangle size={20} className="pulse-icon" />
        <div className="triage-alert-text">
          <strong>{t("triage.criticalAlert", { count })}</strong>
          <span>{t("triage.criticalAlertHint")}</span>
        </div>
      </div>
      {onViewAll && (
        <button className="triage-alert-action" onClick={onViewAll}>
          {t("triage.viewAll")}
        </button>
      )}
    </div>
  );
}

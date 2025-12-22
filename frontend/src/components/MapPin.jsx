import { Marker, Popup } from "react-leaflet";
import { useTranslation } from "react-i18next";
import L from "leaflet";
import "./MapPin.css";

const ICON_SIZE = 32;

// Custom icons for different pin states
const createCustomIcon = (variant) =>
  new L.DivIcon({
    className: `map-pin-icon ${variant}`,
    html: '<span class="map-pin-inner"></span>',
    iconAnchor: [ICON_SIZE / 2, ICON_SIZE],
    popupAnchor: [0, -ICON_SIZE + 6],
  });

// Define icons for each state
const receivedIcon = createCustomIcon("received"); // Gray - received but not verified
const verifiedIcon = createCustomIcon("verified"); // Green - verified but not assigned
const assignedIcon = createCustomIcon("assigned"); // Yellow - assigned to station
const dispatchedIcon = createCustomIcon("dispatched"); // Orange - dispatched from station
const rejectedIcon = createCustomIcon("rejected"); // Red - rejected, needs reroute
const selectedIcon = createCustomIcon("selected"); // Cyan - selected for action
const resolvedIcon = createCustomIcon("resolved"); // Dim - resolved

// Legacy icons for backward compatibility
const unverifiedIcon = createCustomIcon("unverified");
const inProgressIcon = createCustomIcon("in-progress");
const reportIcon = createCustomIcon("report");
const reportSelectedIcon = createCustomIcon("report-selected");
const reportInProgressIcon = createCustomIcon("report-in-progress");

function MapPin({ need, isSelected, onClick }) {
  const { t } = useTranslation();
  const isReport = need.isReport || need.status === "Report";
  const isInProgress = need.status === "InProgress";
  const emergencyStatus = need.emergencyStatus || "none";
  const emergencyType = need.emergencyType || "general";

  // Determine which icon to use based on emergencyStatus
  let icon;

  if (isSelected) {
    icon = selectedIcon;
  } else if (emergencyStatus === "rejected") {
    icon = rejectedIcon;
  } else if (emergencyStatus === "dispatched") {
    icon = dispatchedIcon;
  } else if (emergencyStatus === "assigned") {
    icon = assignedIcon;
  } else if (emergencyStatus === "resolved") {
    icon = resolvedIcon;
  } else if (
    emergencyStatus === "pending" ||
    need.status === "Verified" ||
    need.status === "Analyzed" ||
    need.status === "Analyzed_Full"
  ) {
    icon = verifiedIcon;
  } else if (isInProgress) {
    icon = inProgressIcon;
  } else if (isReport) {
    icon = reportIcon;
  } else {
    // Default gray for received/unverified
    icon = receivedIcon;
  }

  const getStatusLabel = () => {
    // Show emergency status if available
    if (emergencyStatus && emergencyStatus !== "none") {
      const statusLabels = {
        pending: t("map.pendingAssignment", "Pending Assignment"),
        assigned: t("map.assignedToStation", "Assigned to Station"),
        dispatched: t("map.unitsDispatched", "Units Dispatched"),
        rejected: t("map.rejectedNeedsReroute", "Rejected - Needs Reroute"),
        resolved: t("map.resolved", "Resolved"),
      };
      return statusLabels[emergencyStatus] || emergencyStatus;
    }
    if (isReport) return t("map.analyzedReport");
    return need.status;
  };

  const getDescription = () => {
    if (isReport) {
      return need.text || need.description || t("taskList.noDescription");
    }
    return need.description || t("taskList.noDescription");
  };

  const getEmergencyStatusBadge = () => {
    if (!emergencyStatus || emergencyStatus === "none") return null;

    const badgeColors = {
      pending: "#10b981", // Green
      assigned: "#eab308", // Yellow
      dispatched: "#f97316", // Orange
      rejected: "#ef4444", // Red
      resolved: "#6b7280", // Gray
    };

    return (
      <p
        className="pin-emergency-status"
        style={{ color: badgeColors[emergencyStatus] }}
      >
        <strong>🚨 {getStatusLabel()}</strong>
      </p>
    );
  };

  return (
    <Marker
      position={[need.lat, need.lon]}
      icon={icon}
      eventHandlers={{
        click: () => {
          if (onClick) {
            onClick(need.id);
          }
        },
      }}
    >
      <Popup>
        <div className="pin-popup">
          <b>
            {t("map.status")}: {need.status}
          </b>
          {emergencyType && emergencyType !== "none" && (
            <p className="pin-emergency-type">
              <strong>📋 Type:</strong> {emergencyType.toUpperCase()}
            </p>
          )}
          {getEmergencyStatusBadge()}
          {need.assignedStation?.stationName && (
            <p className="pin-station">
              <strong>📍 Station:</strong> {need.assignedStation.stationName}
            </p>
          )}
          {isReport && need.category && (
            <p className="pin-category">
              <strong>{t("map.category")}:</strong> {need.category}
            </p>
          )}
          {isReport && need.severity && (
            <p className="pin-severity">
              <strong>{t("map.severity")}:</strong> {need.severity}/10
            </p>
          )}
          {isReport && need.needs && need.needs.length > 0 && (
            <p className="pin-needs">
              <strong>{t("map.needs")}:</strong> {need.needs.join(", ")}
            </p>
          )}
          <p className="pin-description">{getDescription()}</p>
          {emergencyStatus === "rejected" &&
            need.assignedStation?.rejectionReason && (
              <p className="pin-rejection" style={{ color: "#ef4444" }}>
                <strong>Rejection Reason:</strong>{" "}
                {need.assignedStation.rejectionReason}
              </p>
            )}
          {!isSelected &&
            (need.status === "Verified" ||
              isReport ||
              emergencyStatus === "rejected") && (
              <small>
                {emergencyStatus === "rejected"
                  ? t("map.clickToReroute", "Click to reroute")
                  : t("map.clickToSelect")}
              </small>
            )}
          {isSelected && <small>{t("map.clickToDeselect")}</small>}
        </div>
      </Popup>
    </Marker>
  );
}

export default MapPin;

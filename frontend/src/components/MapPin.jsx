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
const verifiedIcon = createCustomIcon("verified");
const unverifiedIcon = createCustomIcon("unverified");
const selectedIcon = createCustomIcon("selected"); // Brighter green and selected
const inProgressIcon = createCustomIcon("in-progress"); // Orange for routed/in-progress
const reportIcon = createCustomIcon("report"); // New icon for analyzed reports
const reportSelectedIcon = createCustomIcon("report-selected"); // Selected report
const reportInProgressIcon = createCustomIcon("report-in-progress"); // Routed report

function MapPin({ need, isSelected, onClick }) {
  const { t } = useTranslation();
  const isReport = need.isReport || need.status === "Report";
  const isInProgress = need.status === "InProgress";

  // Determine which icon to use
  let icon;
  if (isSelected) {
    icon = isReport ? reportSelectedIcon : selectedIcon;
  } else if (isInProgress) {
    icon = isReport ? reportInProgressIcon : inProgressIcon;
  } else if (isReport) {
    icon = reportIcon;
  } else if (need.status === "Verified") {
    icon = verifiedIcon;
  } else {
    icon = unverifiedIcon;
  }

  const getStatusLabel = () => {
    if (isReport) return t("map.analyzedReport");
    return need.status;
  };

  const getDescription = () => {
    if (isReport) {
      return need.text || need.description || t("taskList.noDescription");
    }
    return need.description || t("taskList.noDescription");
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
            {t("map.status")}: {getStatusLabel()}
          </b>
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
          {!isSelected && (need.status === "Verified" || isReport) && (
            <small>{t("map.clickToSelect")}</small>
          )}
          {isSelected && <small>{t("map.clickToDeselect")}</small>}
        </div>
      </Popup>
    </Marker>
  );
}

export default MapPin;

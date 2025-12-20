import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import "./Map.css";

import MapPin from "./MapPin";
import RouteLine from "./RouteLine";
import OfflineMapManager from "./OfflineMapManager";

// User location icon for volunteer's current position
const createUserLocationIcon = () =>
  new L.DivIcon({
    className: "user-location-icon",
    html: `<div class="user-location-marker"><div class="user-location-pulse"></div><div class="user-location-dot"></div></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });

// --- FIX for default Leaflet icon ---
// This prevents the default marker icon from being broken
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});
// ---------------------------------

// Resource Station Icons
const createStationIcon = (label, color, isHighlighted = false) =>
  new L.DivIcon({
    className: `station-icon ${isHighlighted ? "station-highlighted" : ""}`,
    html: `<div class="station-marker ${
      isHighlighted ? "highlighted" : ""
    }" style="background:${color};"><span class="station-label">${label}</span></div>`,
    iconSize: [isHighlighted ? 48 : 36, isHighlighted ? 48 : 36],
    iconAnchor: [isHighlighted ? 24 : 18, isHighlighted ? 24 : 18],
    popupAnchor: [0, -20],
  });

const getStationIcon = (type, isRerouteMode) => {
  const colors = {
    police: "#3b82f6",
    hospital: "#ef4444",
    fire: "#f97316",
    rescue: "#10b981",
    command: "#6b7280",
  };
  const labels = {
    police: "P",
    hospital: "H",
    fire: "F",
    rescue: "R",
    command: "C",
  };
  return createStationIcon(
    labels[type] || "?",
    colors[type] || "#6b7280",
    isRerouteMode
  );
};

// Resource Stations Data (matching backend)
const RESOURCE_STATIONS = [
  {
    type: "police",
    name: "Police Station 1 - Pimpri",
    lat: 18.6073,
    lon: 73.7654,
  },
  {
    type: "police",
    name: "Police Station 2 - Chinchwad",
    lat: 18.64,
    lon: 73.7945,
  },
  { type: "hospital", name: "Hospital 1 - Wakad", lat: 18.5135, lon: 73.7604 },
  {
    type: "hospital",
    name: "Hospital 2 - Hadapsar",
    lat: 18.4852,
    lon: 73.9047,
  },
  {
    type: "hospital",
    name: "Hospital 3 - Hinjewadi",
    lat: 18.587,
    lon: 73.7785,
  },
  { type: "fire", name: "Fire Station - Swargate", lat: 18.4549, lon: 73.8563 },
  {
    type: "rescue",
    name: "Rescue Station - Shivajinagar",
    lat: 18.5196,
    lon: 73.8553,
  },
];

// Colors for different station type routes
const ROUTE_COLORS = {
  police: "#3b82f6",
  hospital: "#ef4444",
  fire: "#f97316",
  rescue: "#10b981",
  volunteer: "#8b5cf6",
  default: "#8b5cf6",
};

function Map({
  needs,
  selectedNeedIds,
  onPinClick,
  missionRoutes = [],
  isRerouteMode = false,
  onStationClick,
  volunteerMode = false,
  volunteerLocation = null,
  volunteerRoute = null,
  isRouteFallback = false,
}) {
  const { t } = useTranslation();
  // Center on Pune area to show all stations, or on volunteer location if in volunteer mode
  const centerPosition = useMemo(() => {
    if (volunteerMode && volunteerLocation) {
      return [volunteerLocation.lat, volunteerLocation.lng];
    }
    return [18.52, 73.85];
  }, [volunteerMode, volunteerLocation]);

  const handleStationClick = (e, station) => {
    console.log(
      "Station clicked:",
      station.name,
      "isRerouteMode:",
      isRerouteMode
    );
    if (isRerouteMode && onStationClick) {
      e.originalEvent?.stopPropagation();
      e.originalEvent?.preventDefault();
      console.log("Calling onStationClick with station:", station);
      onStationClick(station);
    }
  };

  return (
    <MapContainer
      center={centerPosition}
      zoom={volunteerMode ? 14 : 12}
      className="map-container"
    >
      {/* Base map tiles */}
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />

      {/* 1. Render Resource Station Markers - Only for managers, not volunteers */}
      {!volunteerMode &&
        RESOURCE_STATIONS.map((station, index) => (
          <Marker
            key={`station-${index}-${isRerouteMode}`}
            position={[station.lat, station.lon]}
            icon={getStationIcon(station.type, isRerouteMode)}
            eventHandlers={{
              click: (e) => handleStationClick(e, station),
            }}
          >
            {!isRerouteMode && (
              <Popup>
                <div className="station-popup">
                  <strong>{station.name}</strong>
                  <br />
                  <span className="station-type">
                    {station.type.toUpperCase()}
                  </span>
                </div>
              </Popup>
            )}
          </Marker>
        ))}

      {/* 2. Render volunteer's current location marker */}
      {volunteerMode && volunteerLocation && (
        <Marker
          position={[volunteerLocation.lat, volunteerLocation.lng]}
          icon={createUserLocationIcon()}
        >
          <Popup>
            <div className="user-location-popup">
              <strong>📍 {t("map.yourLocation")}</strong>
            </div>
          </Popup>
        </Marker>
      )}

      {/* 3. Render all the 'Need' Pins */}
      {needs.map((need) => (
        <MapPin
          key={need.id}
          need={need}
          isSelected={selectedNeedIds.has(need.id)}
          onClick={onPinClick}
        />
      ))}

      {/* 4. Render mission routes from logistics agent - Only for managers */}
      {!volunteerMode &&
        missionRoutes.map((missionRoute, index) => (
          <RouteLine
            key={`mission-${index}-${missionRoute.vehicleId}`}
            route={missionRoute.route}
            color={
              ROUTE_COLORS[missionRoute.stationType] || ROUTE_COLORS.default
            }
          />
        ))}

      {/* 5. Render volunteer route to assigned task */}
      {volunteerMode && volunteerRoute && volunteerRoute.length >= 2 && (
        <RouteLine
          key="volunteer-route"
          route={volunteerRoute}
          color={ROUTE_COLORS.volunteer}
          dashed={isRouteFallback}
        />
      )}

      {/* 6. Offline Map Manager for downloading tiles */}
      <OfflineMapManager />
    </MapContainer>
  );
}

export default Map;

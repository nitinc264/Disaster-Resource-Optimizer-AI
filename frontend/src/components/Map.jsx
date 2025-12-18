import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import { useEffect } from "react";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import "./Map.css";

import MapPin from "./MapPin";
import RouteLine from "./RouteLine";
import OfflineMapManager from "./OfflineMapManager";

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
  default: "#8b5cf6",
};

function Map({
  needs,
  selectedNeedIds,
  onPinClick,
  missionRoutes = [],
  isRerouteMode = false,
  onStationClick,
}) {
  // Center on Pune area to show all stations
  const centerPosition = [18.52, 73.85];

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
    <MapContainer center={centerPosition} zoom={12} className="map-container">
      {/* Base map tiles */}
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />

      {/* 1. Render Resource Station Markers */}
      {RESOURCE_STATIONS.map((station, index) => (
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

      {/* 2. Render all the 'Need' Pins */}
      {needs.map((need) => (
        <MapPin
          key={need.id}
          need={need}
          isSelected={selectedNeedIds.has(need.id)}
          onClick={onPinClick}
        />
      ))}

      {/* 3. Render mission routes from logistics agent */}
      {missionRoutes.map((missionRoute, index) => (
        <RouteLine
          key={`mission-${index}-${missionRoute.vehicleId}`}
          route={missionRoute.route}
          color={ROUTE_COLORS[missionRoute.stationType] || ROUTE_COLORS.default}
        />
      ))}

      {/* 4. Offline Map Manager for downloading tiles */}
      <OfflineMapManager />
    </MapContainer>
  );
}

export default Map;

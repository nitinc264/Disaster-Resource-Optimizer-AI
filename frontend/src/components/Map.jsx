import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import "./Map.css";

import MapPin from "./MapPin";
import RouteLine from "./RouteLine";
import OfflineMapManager from "./OfflineMapManager";
import { getAllStations } from "../services/emergencyStationService";

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

// Shelter Icon
const createShelterIcon = (status) => {
  const color =
    status === "open" ? "#10b981" : status === "full" ? "#ef4444" : "#6b7280";
  return new L.DivIcon({
    className: "shelter-icon",
    html: `<div class="shelter-marker" style="background:${color};"><span class="shelter-label">🏠</span></div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -20],
  });
};

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
    isRerouteMode,
  );
};

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
  shelters = [],
}) {
  const { t } = useTranslation();
  const [registeredStations, setRegisteredStations] = useState([]);

  // Fetch registered emergency stations from the API
  useEffect(() => {
    if (!volunteerMode) {
      const fetchStations = async () => {
        try {
          const response = await getAllStations({ status: "active" });
          if (response.success && response.data?.stations) {
            setRegisteredStations(response.data.stations);
          }
        } catch (error) {
          console.error("Failed to fetch emergency stations:", error);
          setRegisteredStations([]); // Fallback to empty array on error
        }
      };
      fetchStations();
    }
  }, [volunteerMode]);

  // Center on Pune area to show all stations, or on volunteer location if in volunteer mode
  const centerPosition = useMemo(() => {
    if (volunteerMode && volunteerLocation) {
      return [volunteerLocation.lat, volunteerLocation.lng];
    }
    return [18.52, 73.85];
  }, [volunteerMode, volunteerLocation]);

  const handleStationClick = (e, station) => {
    if (isRerouteMode && onStationClick) {
      e.originalEvent?.stopPropagation();
      e.originalEvent?.preventDefault();
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

      {/* 1. Render Registered Emergency Station Markers - Only for managers, not volunteers */}
      {!volunteerMode &&
        registeredStations.map((station) => (
          <Marker
            key={`station-${station._id}-${isRerouteMode}`}
            position={[station.location.lat, station.location.lng]}
            icon={getStationIcon(station.type, isRerouteMode)}
            eventHandlers={{
              click: (e) =>
                handleStationClick(e, {
                  ...station,
                  lat: station.location.lat,
                  lon: station.location.lng,
                }),
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
                  <br />
                  <small style={{ color: "#666" }}>
                    {station.location.address ||
                      `${station.location.lat.toFixed(
                        4,
                      )}, ${station.location.lng.toFixed(4)}`}
                  </small>
                  <br />
                  <small
                    style={{
                      color:
                        station.status === "active" ? "#10b981" : "#f59e0b",
                    }}
                  >
                    ● {station.status}
                  </small>
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

      {/* 6. Render Shelter Markers - Visible to all roles */}
      {shelters.map((shelter) => (
        <Marker
          key={`shelter-${shelter.shelterId || shelter._id}`}
          position={[shelter.location.lat, shelter.location.lng]}
          icon={createShelterIcon(shelter.status)}
        >
          <Popup>
            <div className="shelter-popup">
              <strong>{shelter.name}</strong>
              <div className="shelter-popup-type">
                {(shelter.type || "shelter").replace(/_/g, " ").toUpperCase()}
              </div>
              <div className="shelter-popup-status">
                <span
                  className={`shelter-status-dot ${
                    shelter.status === "open"
                      ? "open"
                      : shelter.status === "full"
                        ? "full"
                        : "closed"
                  }`}
                ></span>
                {shelter.status?.toUpperCase() || "UNKNOWN"}
              </div>
              <div className="shelter-popup-capacity">
                <span className="shelter-popup-label">
                  {t("shelter.capacity", "Capacity")}:
                </span>{" "}
                {shelter.capacity?.current || 0} /{" "}
                {shelter.capacity?.total || 0}
                <span className="shelter-popup-avail">
                  (
                  {shelter.availableSpots ??
                    (shelter.capacity?.total || 0) -
                      (shelter.capacity?.current || 0)}{" "}
                  {t("shelter.spotsAvailable", "spots available")})
                </span>
              </div>
              {shelter.location?.address && (
                <div className="shelter-popup-address">
                  📍 {shelter.location.address}
                </div>
              )}
              {shelter.contact?.phone && (
                <div className="shelter-popup-phone">
                  📞 {shelter.contact.phone}
                </div>
              )}
              {shelter.facilities && (
                <div className="shelter-popup-facilities">
                  {shelter.facilities.hasMedicalFacility && (
                    <span title="Medical">🏥</span>
                  )}
                  {shelter.facilities.hasKitchen && (
                    <span title="Kitchen">🍳</span>
                  )}
                  {shelter.facilities.hasWater && <span title="Water">💧</span>}
                  {shelter.facilities.hasElectricity && (
                    <span title="Electricity">⚡</span>
                  )}
                  {shelter.facilities.hasInternet && (
                    <span title="Internet">📶</span>
                  )}
                  {shelter.facilities.isAccessible && (
                    <span title="Accessible">♿</span>
                  )}
                  {shelter.facilities.hasPetArea && (
                    <span title="Pet Friendly">🐾</span>
                  )}
                </div>
              )}
            </div>
          </Popup>
        </Marker>
      ))}

      {/* 7. Offline Map Manager for downloading tiles */}
      <OfflineMapManager />
    </MapContainer>
  );
}

export default Map;

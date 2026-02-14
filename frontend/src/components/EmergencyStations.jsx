import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  getAllStations,
  getAllAlerts,
  registerStation,
  deleteStation,
  pingStation,
  dispatchAlert,
  updateAlertStatus,
  getStationTypeInfo,
  getEmergencyTypeInfo,
  getSeverityInfo,
} from "../services/emergencyStationService";
import "./EmergencyStations.css";

export default function EmergencyStations() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState("stations");
  const [stations, setStations] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [showDispatchForm, setShowDispatchForm] = useState(false);
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  // Fetch stations and alerts
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [stationsRes, alertsRes] = await Promise.all([
        getAllStations({ type: filterType, status: filterStatus }),
        getAllAlerts({ limit: 50 }),
      ]);
      setStations(stationsRes.data?.stations || []);
      setAlerts(alertsRes.data?.alerts || []);
    } catch (err) {
      setError(
        err.response?.data?.message || t("emergencyStations.failedToLoad"),
      );
    } finally {
      setLoading(false);
    }
  }, [filterType, filterStatus]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle station ping
  const handlePing = async (stationId) => {
    try {
      const result = await pingStation(stationId);
      alert(
        t("emergencyStations.pingResult", {
          status: result.data?.status || "unknown",
        }),
      );
      fetchData();
    } catch (err) {
      alert(t("emergencyStations.failedToPing"));
    }
  };

  // Handle station delete
  const handleDelete = async (stationId, stationName) => {
    if (
      !window.confirm(
        t("emergencyStations.confirmDelete", { name: stationName }),
      )
    ) {
      return;
    }
    try {
      await deleteStation(stationId);
      fetchData();
    } catch (err) {
      alert(t("emergencyStations.failedToDelete"));
    }
  };

  // Handle alert status update
  const handleAlertStatusUpdate = async (alertId, newStatus) => {
    try {
      await updateAlertStatus(alertId, newStatus);
      fetchData();
    } catch (err) {
      alert(t("emergencyStations.failedToUpdateAlert"));
    }
  };

  return (
    <div className="emergency-stations">
      <header className="es-header">
        <h1>🚨 {t("emergencyStations.title")}</h1>
        <p>{t("emergencyStations.subtitle")}</p>
      </header>

      {/* Tabs */}
      <div className="es-tabs">
        <button
          className={`es-tab ${activeTab === "stations" ? "active" : ""}`}
          onClick={() => setActiveTab("stations")}
        >
          🏢 {t("emergencyStations.stationsTab")} ({stations.length})
        </button>
        <button
          className={`es-tab ${activeTab === "alerts" ? "active" : ""}`}
          onClick={() => setActiveTab("alerts")}
        >
          🚨 {t("emergencyStations.alertsTab")} (
          {alerts.filter((a) => a.status !== "resolved").length})
        </button>
      </div>

      {error && <div className="es-error">{error}</div>}

      {/* Stations Tab */}
      {activeTab === "stations" && (
        <div className="es-content">
          <div className="es-toolbar">
            <div className="es-filters">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
              >
                <option value="">{t("emergencyStations.allTypes")}</option>
                <option value="fire">
                  🚒 {t("emergencyStations.fireStations")}
                </option>
                <option value="hospital">
                  🏥 {t("emergencyStations.hospitals")}
                </option>
                <option value="police">
                  🚔 {t("emergencyStations.policeStations")}
                </option>
                <option value="rescue">
                  🚑 {t("emergencyStations.rescueTeams")}
                </option>
              </select>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="">{t("emergencyStations.allStatus")}</option>
                <option value="active">{t("emergencyStations.active")}</option>
                <option value="inactive">
                  {t("emergencyStations.inactive")}
                </option>
                <option value="offline">
                  {t("emergencyStations.offline")}
                </option>
              </select>
            </div>
            <button
              className="btn btn-primary"
              onClick={() => setShowRegisterForm(true)}
            >
              + {t("emergencyStations.registerStation")}
            </button>
          </div>

          {loading ? (
            <div className="es-loading">{t("emergencyStations.loading")}</div>
          ) : stations.length === 0 ? (
            <div className="es-empty">
              <span className="es-empty-icon">🏢</span>
              <h3>{t("emergencyStations.noStations")}</h3>
              <p>{t("emergencyStations.noStationsHint")}</p>
              <button
                className="btn btn-primary"
                onClick={() => setShowRegisterForm(true)}
              >
                {t("emergencyStations.registerFirst")}
              </button>
            </div>
          ) : (
            <div className="es-grid">
              {stations.map((station) => {
                const typeInfo = getStationTypeInfo(station.type);
                return (
                  <div
                    key={station._id}
                    className={`es-card station-card ${station.status}`}
                  >
                    <div className="station-header">
                      <span className="station-emoji">{typeInfo.emoji}</span>
                      <div className="station-info">
                        <h3>{station.name}</h3>
                        <span
                          className="station-type-badge"
                          style={{
                            backgroundColor: typeInfo.bgColor,
                            color: typeInfo.color,
                          }}
                        >
                          {typeInfo.label}
                        </span>
                      </div>
                      <span className={`status-badge ${station.status}`}>
                        {station.status}
                      </span>
                    </div>
                    <div className="station-details">
                      <div className="detail-row">
                        <span className="detail-label">📍 Location</span>
                        <span className="detail-value">
                          {station.location?.address ||
                            `${station.location?.lat?.toFixed(
                              4,
                            )}, ${station.location?.lng?.toFixed(4)}`}
                        </span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">
                          🔗 {t("emergencyStations.apiUrl")}
                        </span>
                        <span className="detail-value">
                          {station.apiConfig?.baseUrl}
                        </span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">
                          📊 {t("emergencyStations.alerts")}
                        </span>
                        <span className="detail-value">
                          {station.stats?.totalAlertsReceived || 0}{" "}
                          {t("emergencyStations.received")}
                        </span>
                      </div>
                      {station.lastPingAt && (
                        <div className="detail-row">
                          <span className="detail-label">
                            🕐 {t("emergencyStations.lastPing")}
                          </span>
                          <span className="detail-value">
                            {new Date(station.lastPingAt).toLocaleString()}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="station-capabilities">
                      {station.capabilities?.slice(0, 4).map((cap) => (
                        <span key={cap} className="capability-tag">
                          {cap}
                        </span>
                      ))}
                      {station.capabilities?.length > 4 && (
                        <span className="capability-tag more">
                          +{station.capabilities.length - 4}
                        </span>
                      )}
                    </div>
                    <div className="station-actions">
                      <button
                        className="btn btn-secondary"
                        onClick={() => handlePing(station._id)}
                      >
                        📡 {t("emergencyStations.ping")}
                      </button>
                      <button
                        className="btn es-btn-danger"
                        onClick={() => handleDelete(station._id, station.name)}
                      >
                        🗑️ {t("emergencyStations.delete")}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Alerts Tab */}
      {activeTab === "alerts" && (
        <div className="es-content">
          <div className="es-toolbar">
            <div className="es-filters">
              <span className="filter-label">
                {t("emergencyStations.filter")}
              </span>
              <button
                className={`filter-btn ${filterStatus === "" ? "active" : ""}`}
                onClick={() => setFilterStatus("")}
              >
                {t("emergencyStations.all")}
              </button>
              <button
                className={`filter-btn ${
                  filterStatus === "dispatched" ? "active" : ""
                }`}
                onClick={() => setFilterStatus("dispatched")}
              >
                {t("emergencyStations.active")}
              </button>
              <button
                className={`filter-btn ${
                  filterStatus === "resolved" ? "active" : ""
                }`}
                onClick={() => setFilterStatus("resolved")}
              >
                {t("emergencyStations.resolved")}
              </button>
            </div>
            <button
              className="btn btn-primary"
              onClick={() => setShowDispatchForm(true)}
            >
              + {t("emergencyStations.manualAlert")}
            </button>
          </div>

          {loading ? (
            <div className="es-loading">
              {t("emergencyStations.loadingAlerts")}
            </div>
          ) : alerts.length === 0 ? (
            <div className="es-empty">
              <span className="es-empty-icon">✅</span>
              <h3>{t("emergencyStations.noAlerts")}</h3>
              <p>{t("emergencyStations.noAlertsHint")}</p>
            </div>
          ) : (
            <div className="alerts-list">
              {alerts.map((alert) => {
                const typeInfo = getEmergencyTypeInfo(alert.emergencyType);
                const severityInfo = getSeverityInfo(alert.severity);
                return (
                  <div
                    key={alert._id}
                    className={`es-card alert-card ${alert.status} ${
                      alert.severity >= 7 ? "critical" : ""
                    }`}
                  >
                    <div className="alert-header">
                      <div className="alert-title-row">
                        <span className="alert-emoji">{typeInfo.emoji}</span>
                        <h3>{alert.title}</h3>
                      </div>
                      <div className="alert-badges">
                        <span
                          className="severity-badge"
                          style={{
                            backgroundColor: severityInfo.bgColor,
                            color: severityInfo.color,
                          }}
                        >
                          {alert.severity}/10 {severityInfo.label}
                        </span>
                        <span className={`status-badge ${alert.status}`}>
                          {alert.status}
                        </span>
                      </div>
                    </div>
                    <p className="alert-description">{alert.description}</p>
                    <div className="alert-details">
                      <div className="detail-row">
                        <span className="detail-label">
                          📍 {t("emergencyStations.location")}
                        </span>
                        <span className="detail-value">
                          {alert.location?.address ||
                            `${alert.location?.lat?.toFixed(
                              4,
                            )}, ${alert.location?.lng?.toFixed(4)}`}
                        </span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">
                          🏢 {t("emergencyStations.stationsNotified")}
                        </span>
                        <span className="detail-value">
                          {alert.sentToStations?.length || 0}{" "}
                          {t("emergencyStations.stations")}
                        </span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">
                          🕐 {t("emergencyStations.created")}
                        </span>
                        <span className="detail-value">
                          {new Date(alert.createdAt).toLocaleString()}
                        </span>
                      </div>
                    </div>
                    {alert.sentToStations?.length > 0 && (
                      <div className="alert-stations">
                        <span className="stations-label">
                          {t("emergencyStations.sentTo")}
                        </span>
                        {alert.sentToStations.map((s, idx) => {
                          const stationTypeInfo = getStationTypeInfo(
                            s.stationType,
                          );
                          return (
                            <span
                              key={idx}
                              className={`station-tag ${s.deliveryStatus}`}
                              title={`${s.distance?.toFixed(2) || "?"} km away`}
                            >
                              {stationTypeInfo.emoji} {s.stationName}
                              <span className="delivery-status">
                                {s.deliveryStatus === "delivered"
                                  ? "✓"
                                  : s.deliveryStatus === "failed"
                                    ? "✗"
                                    : "..."}
                              </span>
                            </span>
                          );
                        })}
                      </div>
                    )}
                    {alert.status !== "resolved" && (
                      <div className="alert-actions">
                        <button
                          className="btn es-btn-success"
                          onClick={() =>
                            handleAlertStatusUpdate(alert.alertId, "resolved")
                          }
                        >
                          ✓ {t("emergencyStations.markResolved")}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Register Station Modal */}
      {showRegisterForm && (
        <RegisterStationModal
          onClose={() => setShowRegisterForm(false)}
          onSuccess={() => {
            setShowRegisterForm(false);
            fetchData();
          }}
        />
      )}

      {/* Dispatch Alert Modal */}
      {showDispatchForm && (
        <DispatchAlertModal
          onClose={() => setShowDispatchForm(false)}
          onSuccess={() => {
            setShowDispatchForm(false);
            fetchData();
          }}
        />
      )}
    </div>
  );
}

// Register Station Modal Component
function RegisterStationModal({ onClose, onSuccess }) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    stationId: "",
    name: "",
    type: "fire",
    lat: "",
    lng: "",
    address: "",
    baseUrl: "http://localhost:4001",
    alertEndpoint: "/api/alerts/receive",
    apiKey: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const lat = parseFloat(formData.lat);
      const lng = parseFloat(formData.lng);

      if (Number.isNaN(lat) || Number.isNaN(lng)) {
        alert(t("emergencyStations.validCoordinates"));
        setSubmitting(false);
        return;
      }

      if (!formData.apiKey.trim()) {
        alert(t("emergencyStations.apiKeyRequired"));
        setSubmitting(false);
        return;
      }

      await registerStation({
        stationId: formData.stationId,
        name: formData.name,
        type: formData.type,
        location: {
          lat,
          lng,
          address: formData.address,
        },
        apiConfig: {
          baseUrl: formData.baseUrl,
          alertEndpoint: formData.alertEndpoint,
          apiKey: formData.apiKey,
        },
      });
      onSuccess();
    } catch (err) {
      alert(
        err.response?.data?.message || t("emergencyStations.failedToRegister"),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{t("emergencyStations.registerModalTitle")}</h2>
          <button className="modal-close" onClick={onClose}>
            &times;
          </button>
        </div>
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label>{t("emergencyStations.stationId")}</label>
            <input
              type="text"
              value={formData.stationId}
              onChange={(e) =>
                setFormData({ ...formData, stationId: e.target.value })
              }
              placeholder={t("emergencyStations.stationIdPlaceholder")}
              required
            />
          </div>
          <div className="form-group">
            <label>{t("emergencyStations.stationName")}</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder={t("emergencyStations.stationNamePlaceholder")}
              required
            />
          </div>
          <div className="form-group">
            <label>{t("emergencyStations.type")}</label>
            <select
              value={formData.type}
              onChange={(e) =>
                setFormData({ ...formData, type: e.target.value })
              }
            >
              <option value="fire">
                🚒 {t("emergencyStations.fireStation")}
              </option>
              <option value="hospital">
                🏥 {t("emergencyStations.hospital")}
              </option>
              <option value="police">
                🚔 {t("emergencyStations.policeStation")}
              </option>
              <option value="rescue">
                🚑 {t("emergencyStations.rescueTeam")}
              </option>
            </select>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>{t("emergencyStations.latitude")}</label>
              <input
                type="number"
                step="any"
                value={formData.lat}
                onChange={(e) =>
                  setFormData({ ...formData, lat: e.target.value })
                }
                placeholder="18.5204"
                required
              />
            </div>
            <div className="form-group">
              <label>{t("emergencyStations.longitude")}</label>
              <input
                type="number"
                step="any"
                value={formData.lng}
                onChange={(e) =>
                  setFormData({ ...formData, lng: e.target.value })
                }
                placeholder="73.8567"
                required
              />
            </div>
          </div>
          <div className="form-group">
            <label>{t("emergencyStations.address")}</label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) =>
                setFormData({ ...formData, address: e.target.value })
              }
              placeholder={t("emergencyStations.addressPlaceholder")}
            />
          </div>
          <div className="form-group">
            <label>{t("emergencyStations.stationApiUrl")}</label>
            <input
              type="url"
              value={formData.baseUrl}
              onChange={(e) =>
                setFormData({ ...formData, baseUrl: e.target.value })
              }
              placeholder="http://localhost:4001"
              required
            />
          </div>
          <div className="form-group">
            <label>{t("emergencyStations.apiKey")}</label>
            <input
              type="text"
              value={formData.apiKey}
              onChange={(e) =>
                setFormData({ ...formData, apiKey: e.target.value })
              }
              placeholder={t("emergencyStations.apiKeyPlaceholder")}
              required
            />
          </div>
          <div className="form-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
            >
              {t("emergencyStations.cancel")}
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
            >
              {submitting
                ? t("emergencyStations.registering")
                : t("emergencyStations.registerStation")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Dispatch Alert Modal Component
function DispatchAlertModal({ onClose, onSuccess }) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    emergencyType: "fire",
    severity: 5,
    lat: "",
    lng: "",
    title: "",
    description: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      await dispatchAlert({
        emergencyType: formData.emergencyType,
        severity: parseInt(formData.severity),
        location: {
          lat: parseFloat(formData.lat),
          lng: parseFloat(formData.lng),
        },
        title: formData.title,
        description: formData.description,
      });
      onSuccess();
    } catch (err) {
      alert(
        err.response?.data?.message || t("emergencyStations.failedToDispatch"),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{t("emergencyStations.dispatchTitle")}</h2>
          <button className="modal-close" onClick={onClose}>
            &times;
          </button>
        </div>
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label>{t("emergencyStations.emergencyType")}</label>
            <select
              value={formData.emergencyType}
              onChange={(e) =>
                setFormData({ ...formData, emergencyType: e.target.value })
              }
            >
              <option value="fire">🔥 {t("emergencyStations.fire")}</option>
              <option value="flood">🌊 {t("emergencyStations.flood")}</option>
              <option value="earthquake">
                🌍 {t("emergencyStations.earthquake")}
              </option>
              <option value="medical">
                🏥 {t("emergencyStations.medical")}
              </option>
              <option value="rescue">🆘 {t("emergencyStations.rescue")}</option>
              <option value="traffic_accident">
                🚗 {t("emergencyStations.trafficAccident")}
              </option>
              <option value="building_collapse">
                🏚️ {t("emergencyStations.buildingCollapse")}
              </option>
              <option value="general">
                ⚠️ {t("emergencyStations.general")}
              </option>
            </select>
          </div>
          <div className="form-group">
            <label>{t("emergencyStations.severity")}</label>
            <input
              type="range"
              min="1"
              max="10"
              value={formData.severity}
              onChange={(e) =>
                setFormData({ ...formData, severity: e.target.value })
              }
            />
            <span className="severity-value">{formData.severity}</span>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>{t("emergencyStations.latitude")}</label>
              <input
                type="number"
                step="any"
                value={formData.lat}
                onChange={(e) =>
                  setFormData({ ...formData, lat: e.target.value })
                }
                placeholder="18.5204"
                required
              />
            </div>
            <div className="form-group">
              <label>{t("emergencyStations.longitude")}</label>
              <input
                type="number"
                step="any"
                value={formData.lng}
                onChange={(e) =>
                  setFormData({ ...formData, lng: e.target.value })
                }
                placeholder="73.8567"
                required
              />
            </div>
          </div>
          <div className="form-group">
            <label>{t("emergencyStations.alertTitle")}</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              placeholder={t("emergencyStations.alertTitlePlaceholder")}
              required
            />
          </div>
          <div className="form-group">
            <label>{t("emergencyStations.alertDescription")}</label>
            <textarea
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder={t("emergencyStations.alertDescPlaceholder")}
              rows="3"
            />
          </div>
          <div className="form-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
            >
              {t("emergencyStations.cancel")}
            </button>
            <button
              type="submit"
              className="btn es-btn-danger"
              disabled={submitting}
            >
              {submitting
                ? t("emergencyStations.dispatching")
                : `🚨 ${t("emergencyStations.dispatchBtn")}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

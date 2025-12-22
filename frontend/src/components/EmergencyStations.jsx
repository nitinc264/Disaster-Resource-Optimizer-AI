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
      setError(err.response?.data?.message || "Failed to load data");
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
      alert(`Station is ${result.data?.status || "unknown"}`);
      fetchData();
    } catch (err) {
      alert("Failed to ping station");
    }
  };

  // Handle station delete
  const handleDelete = async (stationId, stationName) => {
    if (!window.confirm(`Are you sure you want to delete "${stationName}"?`)) {
      return;
    }
    try {
      await deleteStation(stationId);
      fetchData();
    } catch (err) {
      alert("Failed to delete station");
    }
  };

  // Handle alert status update
  const handleAlertStatusUpdate = async (alertId, newStatus) => {
    try {
      await updateAlertStatus(alertId, newStatus);
      fetchData();
    } catch (err) {
      alert("Failed to update alert status");
    }
  };

  return (
    <div className="emergency-stations">
      <header className="es-header">
        <h1>🚨 Emergency Station Management</h1>
        <p>Manage registered emergency stations and monitor alerts</p>
      </header>

      {/* Tabs */}
      <div className="es-tabs">
        <button
          className={`es-tab ${activeTab === "stations" ? "active" : ""}`}
          onClick={() => setActiveTab("stations")}
        >
          🏢 Stations ({stations.length})
        </button>
        <button
          className={`es-tab ${activeTab === "alerts" ? "active" : ""}`}
          onClick={() => setActiveTab("alerts")}
        >
          🚨 Alerts ({alerts.filter((a) => a.status !== "resolved").length})
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
                <option value="">All Types</option>
                <option value="fire">🚒 Fire Stations</option>
                <option value="hospital">🏥 Hospitals</option>
                <option value="police">🚔 Police Stations</option>
                <option value="rescue">🚑 Rescue Teams</option>
              </select>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="offline">Offline</option>
              </select>
            </div>
            <button
              className="es-btn es-btn-primary"
              onClick={() => setShowRegisterForm(true)}
            >
              + Register Station
            </button>
          </div>

          {loading ? (
            <div className="es-loading">Loading stations...</div>
          ) : stations.length === 0 ? (
            <div className="es-empty">
              <span className="es-empty-icon">🏢</span>
              <h3>No Stations Registered</h3>
              <p>Register emergency stations to receive alerts</p>
              <button
                className="es-btn es-btn-primary"
                onClick={() => setShowRegisterForm(true)}
              >
                Register First Station
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
                              4
                            )}, ${station.location?.lng?.toFixed(4)}`}
                        </span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">🔗 API URL</span>
                        <span className="detail-value">
                          {station.apiConfig?.baseUrl}
                        </span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">📊 Alerts</span>
                        <span className="detail-value">
                          {station.stats?.totalAlertsReceived || 0} received
                        </span>
                      </div>
                      {station.lastPingAt && (
                        <div className="detail-row">
                          <span className="detail-label">🕐 Last Ping</span>
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
                        className="es-btn es-btn-secondary"
                        onClick={() => handlePing(station._id)}
                      >
                        📡 Ping
                      </button>
                      <button
                        className="es-btn es-btn-danger"
                        onClick={() => handleDelete(station._id, station.name)}
                      >
                        🗑️ Delete
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
              <span className="filter-label">Filter:</span>
              <button
                className={`filter-btn ${filterStatus === "" ? "active" : ""}`}
                onClick={() => setFilterStatus("")}
              >
                All
              </button>
              <button
                className={`filter-btn ${
                  filterStatus === "dispatched" ? "active" : ""
                }`}
                onClick={() => setFilterStatus("dispatched")}
              >
                Active
              </button>
              <button
                className={`filter-btn ${
                  filterStatus === "resolved" ? "active" : ""
                }`}
                onClick={() => setFilterStatus("resolved")}
              >
                Resolved
              </button>
            </div>
            <button
              className="es-btn es-btn-primary"
              onClick={() => setShowDispatchForm(true)}
            >
              + Manual Alert
            </button>
          </div>

          {loading ? (
            <div className="es-loading">Loading alerts...</div>
          ) : alerts.length === 0 ? (
            <div className="es-empty">
              <span className="es-empty-icon">✅</span>
              <h3>No Alerts</h3>
              <p>No emergency alerts have been dispatched</p>
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
                        <span className="detail-label">📍 Location</span>
                        <span className="detail-value">
                          {alert.location?.address ||
                            `${alert.location?.lat?.toFixed(
                              4
                            )}, ${alert.location?.lng?.toFixed(4)}`}
                        </span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">
                          🏢 Stations Notified
                        </span>
                        <span className="detail-value">
                          {alert.sentToStations?.length || 0} stations
                        </span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">🕐 Created</span>
                        <span className="detail-value">
                          {new Date(alert.createdAt).toLocaleString()}
                        </span>
                      </div>
                    </div>
                    {alert.sentToStations?.length > 0 && (
                      <div className="alert-stations">
                        <span className="stations-label">Sent to:</span>
                        {alert.sentToStations.map((s, idx) => {
                          const stationTypeInfo = getStationTypeInfo(
                            s.stationType
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
                          className="es-btn es-btn-success"
                          onClick={() =>
                            handleAlertStatusUpdate(alert.alertId, "resolved")
                          }
                        >
                          ✓ Mark Resolved
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
        alert("Please enter valid latitude and longitude values.");
        setSubmitting(false);
        return;
      }

      if (!formData.apiKey.trim()) {
        alert("API key is required to register a station.");
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
      alert(err.response?.data?.message || "Failed to register station");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Register Emergency Station</h2>
          <button className="modal-close" onClick={onClose}>
            &times;
          </button>
        </div>
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label>Station ID</label>
            <input
              type="text"
              value={formData.stationId}
              onChange={(e) =>
                setFormData({ ...formData, stationId: e.target.value })
              }
              placeholder="e.g., FIRE-STATION-001"
              required
            />
          </div>
          <div className="form-group">
            <label>Station Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="e.g., Central Fire Station"
              required
            />
          </div>
          <div className="form-group">
            <label>Type</label>
            <select
              value={formData.type}
              onChange={(e) =>
                setFormData({ ...formData, type: e.target.value })
              }
            >
              <option value="fire">🚒 Fire Station</option>
              <option value="hospital">🏥 Hospital</option>
              <option value="police">🚔 Police Station</option>
              <option value="rescue">🚑 Rescue Team</option>
            </select>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Latitude</label>
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
              <label>Longitude</label>
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
            <label>Address</label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) =>
                setFormData({ ...formData, address: e.target.value })
              }
              placeholder="e.g., Swargate, Pune"
            />
          </div>
          <div className="form-group">
            <label>Station API URL</label>
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
            <label>API Key</label>
            <input
              type="text"
              value={formData.apiKey}
              onChange={(e) =>
                setFormData({ ...formData, apiKey: e.target.value })
              }
              placeholder="Station's API key for authentication"
              required
            />
          </div>
          <div className="form-actions">
            <button
              type="button"
              className="es-btn es-btn-secondary"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="es-btn es-btn-primary"
              disabled={submitting}
            >
              {submitting ? "Registering..." : "Register Station"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Dispatch Alert Modal Component
function DispatchAlertModal({ onClose, onSuccess }) {
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
      alert(err.response?.data?.message || "Failed to dispatch alert");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Manual Emergency Alert</h2>
          <button className="modal-close" onClick={onClose}>
            &times;
          </button>
        </div>
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label>Emergency Type</label>
            <select
              value={formData.emergencyType}
              onChange={(e) =>
                setFormData({ ...formData, emergencyType: e.target.value })
              }
            >
              <option value="fire">🔥 Fire</option>
              <option value="flood">🌊 Flood</option>
              <option value="earthquake">🌍 Earthquake</option>
              <option value="medical">🏥 Medical</option>
              <option value="rescue">🆘 Rescue</option>
              <option value="traffic_accident">🚗 Traffic Accident</option>
              <option value="building_collapse">🏚️ Building Collapse</option>
              <option value="general">⚠️ General</option>
            </select>
          </div>
          <div className="form-group">
            <label>Severity (1-10)</label>
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
              <label>Latitude</label>
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
              <label>Longitude</label>
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
            <label>Alert Title</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              placeholder="e.g., Fire at residential building"
              required
            />
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="Describe the emergency situation..."
              rows="3"
            />
          </div>
          <div className="form-actions">
            <button
              type="button"
              className="es-btn es-btn-secondary"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="es-btn es-btn-danger"
              disabled={submitting}
            >
              {submitting ? "Dispatching..." : "🚨 Dispatch Alert"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

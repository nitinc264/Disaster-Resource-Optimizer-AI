import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Home,
  Plus,
  X,
  MapPin,
  Users,
  Heart,
  Baby,
  UserCheck,
  AlertTriangle,
  Phone,
  CheckCircle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Wifi,
  Droplets,
  Zap,
  Thermometer,
  ShieldCheck,
  Edit,
  Navigation,
  Loader2,
} from "lucide-react";
import { sheltersAPI } from "../services/apiService";
import Modal from "./Modal";
import "./ShelterManagement.css";

const StatusBadge = ({ status, t }) => {
  const statusConfig = {
    open: { color: "status-open", key: "shelter.statusOpen" },
    full: { color: "status-full", key: "shelter.statusFull" },
    closing: { color: "status-closing", key: "shelter.statusClosing" },
    closed: { color: "status-closed", key: "shelter.statusClosed" },
  };

  const config = statusConfig[status] || statusConfig.closed;

  return (
    <span className={`shelter-status ${config.color}`}>{t(config.key)}</span>
  );
};

const CapacityBar = ({ current, total }) => {
  const currentNum = Number(current) || 0;
  const totalNum = Number(total) || 100;
  const percentage = totalNum > 0 ? Math.min((currentNum / totalNum) * 100, 100) : 0;
  const colorClass =
    percentage >= 90 ? "critical" : percentage >= 70 ? "warning" : "normal";

  return (
    <div className="capacity-bar-container">
      <div className="capacity-bar">
        <div
          className={`capacity-fill ${colorClass}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="capacity-text">
        {currentNum}/{totalNum} ({Math.round(percentage)}%)
      </span>
    </div>
  );
};

const FacilityIcon = ({ facility }) => {
  const icons = {
    water: <Droplets size={14} />,
    electricity: <Zap size={14} />,
    wifi: <Wifi size={14} />,
    heating: <Thermometer size={14} />,
    medical: <Heart size={14} />,
    security: <ShieldCheck size={14} />,
  };

  return icons[facility] || <CheckCircle size={14} />;
};

const ShelterCard = ({ shelter, onEdit, onUpdate }) => {
  const [expanded, setExpanded] = useState(false);
  const { t } = useTranslation();

  // Normalize capacity numbers to avoid NaN/0% display when values are strings or missing
  const currentNum = Number(shelter.capacity?.current) || 0;
  const totalNumRaw = Number(shelter.capacity?.total);
  const totalNum = Number.isFinite(totalNumRaw) && totalNumRaw > 0 ? totalNumRaw : 100;
  const occupancyPercentage = Math.round((currentNum / totalNum) * 100);

  // Helper to get facilities array
  const facilitiesList = Array.isArray(shelter.facilities)
    ? shelter.facilities
    : Object.keys(shelter.facilities || {}).reduce((acc, key) => {
        if (key === "hasWater" && shelter.facilities[key]) acc.push("water");
        if (key === "hasElectricity" && shelter.facilities[key])
          acc.push("electricity");
        if (key === "hasInternet" && shelter.facilities[key]) acc.push("wifi");
        if (key === "hasMedicalFacility" && shelter.facilities[key])
          acc.push("medical");
        if (key === "hasKitchen" && shelter.facilities[key]) acc.push("kitchen");
        if (key === "hasShowers" && shelter.facilities[key] > 0)
          acc.push("showers");
        return acc;
      }, []);

  const contact = shelter.contact || shelter.contactInfo || {};
  const managerName = contact.managerName || contact.manager;

  return (
    <div
      className={`shelter-card ${shelter.status}`}
      onClick={() => setExpanded(!expanded)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") setExpanded(!expanded);
      }}
    >
      <div className="shelter-header">
        <div className="shelter-icon">
          <Home size={20} />
        </div>
        <div className="shelter-info">
          <h4>{shelter.name}</h4>
          <div className="shelter-meta">
            <MapPin size={12} />
            <span>
              {shelter.location?.address || t("shelter.locationNotSpecified")}
            </span>
          </div>
        </div>
        <StatusBadge status={shelter.status} t={t} />
        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </div>

      <div className="shelter-capacity-summary">
        <CapacityBar
          current={shelter.capacity?.current || 0}
          total={shelter.capacity?.total || 100}
        />
      </div>

      <div className="shelter-demographics">
        <div className="demo-item">
          <Users size={14} />
          <span>
            {shelter.capacity?.families || 0} {t("shelter.families")}
          </span>
        </div>
        <div className="demo-item">
          <Baby size={14} />
          <span>
            {shelter.capacity?.children || 0} {t("shelter.children")}
          </span>
        </div>
        <div className="demo-item">
          <UserCheck size={14} />
          <span>
            {shelter.capacity?.elderly || 0} {t("shelter.elderly")}
          </span>
        </div>
      </div>

      {expanded && (
        <div className="shelter-details">
          {facilitiesList.length > 0 && (
            <div className="detail-section">
              <h5>{t("shelter.facilitiesAvailable")}</h5>
              <div className="facilities-list">
                {facilitiesList.map((facility, index) => (
                  <span key={index} className="facility-tag">
                    <FacilityIcon facility={facility} />
                    {facility}
                  </span>
                ))}
              </div>
            </div>
          )}

          {shelter.urgentNeeds && shelter.urgentNeeds.length > 0 && (
            <div className="detail-section urgent">
              <h5>
                <AlertTriangle size={14} />
                {t("shelter.urgentNeeds")}
              </h5>
              <div className="needs-list">
                {shelter.urgentNeeds.map((need, index) => (
                  <span key={index} className="need-tag">
                    {need}
                  </span>
                ))}
              </div>
            </div>
          )}

          {shelter.supplies && (
            <div className="detail-section">
              <h5>{t("shelter.supplyStatus")}</h5>
              <div className="supplies-grid">
                <div className="supply-item">
                  <span className="supply-label">{t("shelter.food")}</span>
                  <span className="supply-status">
                    {typeof shelter.supplies.food === 'object' 
                      ? `${shelter.supplies.food.available || 0}/${shelter.supplies.food.needed || 0} ${shelter.supplies.food.unit || ''}`
                      : shelter.supplies.food || 'N/A'}
                  </span>
                </div>
                <div className="supply-item">
                  <span className="supply-label">{t("shelter.water")}</span>
                  <span className="supply-status">
                    {typeof shelter.supplies.water === 'object'
                      ? `${shelter.supplies.water.available || 0}/${shelter.supplies.water.needed || 0} ${shelter.supplies.water.unit || ''}`
                      : shelter.supplies.water || 'N/A'}
                  </span>
                </div>
                <div className="supply-item">
                  <span className="supply-label">{t("shelter.medical")}</span>
                  <span className="supply-status">
                    {typeof shelter.supplies.medical === 'object'
                      ? `${shelter.supplies.medical.available || 0}/${shelter.supplies.medical.needed || 0} ${shelter.supplies.medical.unit || ''}`
                      : (typeof shelter.supplies.medicalKits === 'object'
                        ? `${shelter.supplies.medicalKits.available || 0}/${shelter.supplies.medicalKits.needed || 0} ${shelter.supplies.medicalKits.unit || ''}`
                        : shelter.supplies.medical || 'N/A')}
                  </span>
                </div>
                <div className="supply-item">
                  <span className="supply-label">{t("shelter.blankets")}</span>
                  <span className="supply-status">
                    {typeof shelter.supplies.blankets === 'object'
                      ? `${shelter.supplies.blankets.available || 0}/${shelter.supplies.blankets.needed || 0} ${shelter.supplies.blankets.unit || ''}`
                      : shelter.supplies.blankets || 'N/A'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {(contact.phone || managerName) && (
            <div className="detail-section">
              <h5>{t("shelter.contact")}</h5>
              <div className="contact-info">
                {contact.phone && (
                  <a href={`tel:${contact.phone}`} className="contact-link">
                    <Phone size={14} />
                    {contact.phone}
                  </a>
                )}
                {managerName && (
                  <span className="manager-name">
                    {t("shelter.manager")}: {managerName}
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="shelter-actions">
            <button 
              className="btn-navigate"
              onClick={(e) => {
                e.stopPropagation();
                const lat = shelter.location?.lat;
                const lng = shelter.location?.lng;
                if (lat && lng) {
                  window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
                } else {
                  alert(t("shelter.locationNotSpecified"));
                }
              }}
            >
              <Navigation size={14} />
              {t("shelter.navigate")}
            </button>
            <button
              className="btn-edit"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(shelter);
              }}
            >
              <Edit size={14} />
              {t("common.edit", "Edit")}
            </button>
            <button
              className="btn-update-capacity"
              onClick={(e) => {
                e.stopPropagation();
                onUpdate(shelter);
              }}
            >
              <Users size={14} />
              {t("shelter.updateCapacity")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// Default fallback location (Pune, India)
const DEFAULT_SHELTER_LOCATION = { lat: 18.5204, lng: 73.8567 };

const AddShelterForm = ({ onSubmit, onCancel, currentLocation: externalLocation, isSubmitting }) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    name: "",
    address: "",
    totalCapacity: 100,
    facilities: [],
    phone: "",
    manager: "",
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
      setLocation(DEFAULT_SHELTER_LOCATION);
      return;
    }

    setLocationStatus("loading");
    setLocationError(null);

    const timeoutId = setTimeout(() => {
      // If location takes too long, use default
      setLocationStatus("error");
      setLocationError("Location timeout - using default");
      setLocation(DEFAULT_SHELTER_LOCATION);
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
        setLocation(DEFAULT_SHELTER_LOCATION); // Use fallback
      },
      {
        enableHighAccuracy: false, // Faster response
        timeout: 8000,
        maximumAge: 60000, // Cache for 1 minute
      }
    );
  };

  const facilityOptions = [
    "water",
    "electricity",
    "wifi",
    "heating",
    "medical",
    "security",
    "kitchen",
    "showers",
    "parking",
  ];

  const toggleFacility = (facility) => {
    setFormData((prev) => ({
      ...prev,
      facilities: prev.facilities.includes(facility)
        ? prev.facilities.filter((f) => f !== facility)
        : [...prev.facilities, facility],
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const trimmedName = (formData.name || "").trim();
    if (!trimmedName) {
      alert(t("shelter.nameRequired") || "Shelter name is required");
      return;
    }

    const finalLocation = location || DEFAULT_SHELTER_LOCATION;

    const shelter = {
      name: formData.name,
      location: {
        address: formData.address,
        lat: finalLocation.lat,
        lng: finalLocation.lng,
      },
      capacity: {
        total: parseInt(formData.totalCapacity),
        current: 0,
        families: 0,
        children: 0,
        elderly: 0,
      },
      facilities: {
        hasWater: formData.facilities.includes("water"),
        hasElectricity: formData.facilities.includes("electricity"),
        hasInternet: formData.facilities.includes("wifi"),
        hasMedicalFacility: formData.facilities.includes("medical"),
        hasKitchen: formData.facilities.includes("kitchen"),
        hasShowers: formData.facilities.includes("showers") ? 1 : 0,
        hasToilets: 0,
        isAccessible: false,
        hasPetArea: false,
      },
      contact: {
        phone: formData.phone,
        managerName: formData.manager,
      },
      status: "open",
    };

    // Ensure name is trimmed when submitting
    onSubmit({ ...shelter, name: trimmedName });
  };

  return (
    <form className="add-shelter-form" onSubmit={handleSubmit}>
      <h4>{t("shelter.registerShelter")}</h4>

      <div className="form-group">
        <label>{t("shelter.shelterName")} *</label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="e.g., Community Center Shelter"
          required
        />
      </div>

      <div className="form-group">
        <label>{t("shelter.address")}</label>
        <input
          type="text"
          value={formData.address}
          onChange={(e) =>
            setFormData({ ...formData, address: e.target.value })
          }
          placeholder="Full address"
        />
      </div>

      <div className={`location-info ${locationStatus}`}>
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

      <div className="form-group">
        <label>{t("shelter.totalCapacity")}</label>
        <input
          type="number"
          value={formData.totalCapacity}
          onChange={(e) =>
            setFormData({ ...formData, totalCapacity: e.target.value })
          }
          placeholder="Maximum people"
          min="1"
        />
      </div>

      <div className="form-group">
        <label>{t("shelter.facilitiesAvailable")}</label>
        <div className="facilities-select">
          {facilityOptions.map((facility) => (
            <button
              key={facility}
              type="button"
              className={`facility-option ${
                formData.facilities.includes(facility) ? "selected" : ""
              }`}
              onClick={() => toggleFacility(facility)}
            >
              <FacilityIcon facility={facility} />
              {facility}
            </button>
          ))}
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>{t("shelter.managerPhone")}</label>
          <input
            type="tel"
            value={formData.phone}
            onChange={(e) =>
              setFormData({ ...formData, phone: e.target.value })
            }
            placeholder="Phone number"
          />
        </div>

        <div className="form-group">
          <label>{t("shelter.managerName")}</label>
          <input
            type="text"
            value={formData.manager}
            onChange={(e) =>
              setFormData({ ...formData, manager: e.target.value })
            }
            placeholder="Manager name"
          />
        </div>
      </div>

      <div className="form-actions">
        <button type="button" className="btn-cancel" onClick={onCancel}>
          {t("common.cancel")}
        </button>
        <button 
          type="submit" 
          className="btn-submit" 
          disabled={!formData.name || (formData.name || "").trim().length === 0 || isSubmitting || locationStatus === "loading"}
        >
          {isSubmitting ? <Loader2 size={14} className="spin" /> : <Home size={14} />}
          {isSubmitting ? t("common.loading") : t("shelter.register")}
        </button>
      </div>
    </form>
  );
};

// Export AddShelterForm for use in full-page view
export { AddShelterForm };

// Edit Shelter Form Component
const EditShelterForm = ({ shelter, onSubmit, onCancel, isSubmitting }) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    name: shelter.name || "",
    address: shelter.location?.address || "",
    totalCapacity: shelter.capacity?.total || 100,
    facilities: [],
    phone: shelter.contact?.phone || shelter.contactInfo?.phone || "",
    manager: shelter.contact?.managerName || shelter.contactInfo?.manager || "",
    status: shelter.status || "open",
  });

  // Initialize facilities from shelter data
  useEffect(() => {
    const facilities = [];
    if (shelter.facilities) {
      if (shelter.facilities.hasWater) facilities.push("water");
      if (shelter.facilities.hasElectricity) facilities.push("electricity");
      if (shelter.facilities.hasInternet) facilities.push("wifi");
      if (shelter.facilities.hasMedicalFacility) facilities.push("medical");
      if (shelter.facilities.hasKitchen) facilities.push("kitchen");
      if (shelter.facilities.hasShowers > 0) facilities.push("showers");
    }
    setFormData(prev => ({ ...prev, facilities }));
  }, [shelter]);

  const facilityOptions = [
    "water",
    "electricity",
    "wifi",
    "heating",
    "medical",
    "security",
    "kitchen",
    "showers",
    "parking",
  ];

  const statusOptions = ["open", "full", "closing", "closed"];

  const toggleFacility = (facility) => {
    setFormData((prev) => ({
      ...prev,
      facilities: prev.facilities.includes(facility)
        ? prev.facilities.filter((f) => f !== facility)
        : [...prev.facilities, facility],
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const trimmedName = (formData.name || "").trim();
    if (!trimmedName) {
      alert(t("shelter.nameRequired") || "Shelter name is required");
      return;
    }

    const updatedShelter = {
      name: trimmedName,
      location: {
        ...shelter.location,
        address: formData.address,
      },
      capacity: {
        ...shelter.capacity,
        total: parseInt(formData.totalCapacity),
      },
      facilities: {
        hasWater: formData.facilities.includes("water"),
        hasElectricity: formData.facilities.includes("electricity"),
        hasInternet: formData.facilities.includes("wifi"),
        hasMedicalFacility: formData.facilities.includes("medical"),
        hasKitchen: formData.facilities.includes("kitchen"),
        hasShowers: formData.facilities.includes("showers") ? 1 : 0,
      },
      contact: {
        phone: formData.phone,
        managerName: formData.manager,
      },
      status: formData.status,
    };

    onSubmit(updatedShelter);
  };

  return (
    <form className="add-shelter-form" onSubmit={handleSubmit}>
      <div className="form-group">
        <label>{t("shelter.shelterName")} *</label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="e.g., Community Center Shelter"
          required
        />
      </div>

      <div className="form-group">
        <label>{t("shelter.address")}</label>
        <input
          type="text"
          value={formData.address}
          onChange={(e) =>
            setFormData({ ...formData, address: e.target.value })
          }
          placeholder="Full address"
        />
      </div>

      <div className="form-group">
        <label>{t("common.status", "Status")}</label>
        <select
          value={formData.status}
          onChange={(e) => setFormData({ ...formData, status: e.target.value })}
          className="status-select"
        >
          {statusOptions.map((status) => (
            <option key={status} value={status}>
              {t(`shelter.status${status.charAt(0).toUpperCase() + status.slice(1)}`)}
            </option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label>{t("shelter.totalCapacity")}</label>
        <input
          type="number"
          value={formData.totalCapacity}
          onChange={(e) =>
            setFormData({ ...formData, totalCapacity: e.target.value })
          }
          placeholder="Maximum people"
          min="1"
        />
      </div>

      <div className="form-group">
        <label>{t("shelter.facilitiesAvailable")}</label>
        <div className="facilities-select">
          {facilityOptions.map((facility) => (
            <button
              key={facility}
              type="button"
              className={`facility-option ${
                formData.facilities.includes(facility) ? "selected" : ""
              }`}
              onClick={() => toggleFacility(facility)}
            >
              <FacilityIcon facility={facility} />
              {facility}
            </button>
          ))}
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>{t("shelter.managerPhone")}</label>
          <input
            type="tel"
            value={formData.phone}
            onChange={(e) =>
              setFormData({ ...formData, phone: e.target.value })
            }
            placeholder="Phone number"
          />
        </div>

        <div className="form-group">
          <label>{t("shelter.managerName")}</label>
          <input
            type="text"
            value={formData.manager}
            onChange={(e) =>
              setFormData({ ...formData, manager: e.target.value })
            }
            placeholder="Manager name"
          />
        </div>
      </div>

      <div className="form-actions">
        <button type="button" className="btn-cancel" onClick={onCancel}>
          {t("common.cancel")}
        </button>
        <button 
          type="submit" 
          className="btn-submit" 
          disabled={!formData.name || (formData.name || "").trim().length === 0 || isSubmitting}
        >
          {isSubmitting ? <Loader2 size={14} className="spin" /> : <Edit size={14} />}
          {isSubmitting ? t("common.loading") : t("shelter.update")}
        </button>
      </div>
    </form>
  );
};

const UpdateCapacityModal = ({ shelter, onUpdate, onClose, t }) => {
  const [capacity, setCapacity] = useState({
    current: shelter.capacity?.current || 0,
    families: shelter.capacity?.families || 0,
    children: shelter.capacity?.children || 0,
    elderly: shelter.capacity?.elderly || 0,
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onUpdate(shelter._id, { capacity: { ...shelter.capacity, ...capacity } });
    onClose();
  };

  return (
    <div className="capacity-modal-overlay" onClick={onClose}>
      <div className="capacity-modal" onClick={(e) => e.stopPropagation()}>
        <div className="capacity-modal-header">
          <h4>
            {t("shelter.updateCapacity")} - {shelter.name}
          </h4>
          <button className="close-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="capacity-inputs">
            <div className="capacity-input">
              <label>
                <Users size={16} />
                {t("shelter.currentOccupancy")}
              </label>
              <input
                type="number"
                value={capacity.current}
                onChange={(e) =>
                  setCapacity({
                    ...capacity,
                    current: parseInt(e.target.value) || 0,
                  })
                }
                min="0"
                max={shelter.capacity?.total || 999}
              />
              <span className="max-label">
                of {shelter.capacity?.total || 0}
              </span>
            </div>

            <div className="capacity-input">
              <label>
                <Home size={16} />
                {t("shelter.families")}
              </label>
              <input
                type="number"
                value={capacity.families}
                onChange={(e) =>
                  setCapacity({
                    ...capacity,
                    families: parseInt(e.target.value) || 0,
                  })
                }
                min="0"
              />
            </div>

            <div className="capacity-input">
              <label>
                <Baby size={16} />
                {t("shelter.children")}
              </label>
              <input
                type="number"
                value={capacity.children}
                onChange={(e) =>
                  setCapacity({
                    ...capacity,
                    children: parseInt(e.target.value) || 0,
                  })
                }
                min="0"
              />
            </div>

            <div className="capacity-input">
              <label>
                <UserCheck size={16} />
                {t("shelter.elderly")}
              </label>
              <input
                type="number"
                value={capacity.elderly}
                onChange={(e) =>
                  setCapacity({
                    ...capacity,
                    elderly: parseInt(e.target.value) || 0,
                  })
                }
                min="0"
              />
            </div>
          </div>

          <div className="capacity-modal-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>
              {t("common.cancel")}
            </button>
            <button type="submit" className="btn-submit">
              <CheckCircle size={14} />
              {t("shelter.update")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default function ShelterManagement({ currentLocation }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedShelter, setSelectedShelter] = useState(null);
  const [showCapacityModal, setShowCapacityModal] = useState(false);
  const [filter, setFilter] = useState("all");

  // Fetch shelters
  const {
    data: shelters,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["shelters", filter],
    queryFn: () =>
      sheltersAPI.getAll({ status: filter !== "all" ? filter : undefined }),
    select: (response) => response?.data?.data || [],
    refetchInterval: 30000,
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data) => sheltersAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(["shelters"]);
      setShowAddForm(false);
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => sheltersAPI.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(["shelters"]);
    },
  });

  const handleAddShelter = (data) => {
    createMutation.mutate(data, {
      onError: (err) => {
        console.error("Error registering shelter:", err);
        const message = err?.response?.data?.message || t("shelter.errorRegister");
        alert(message || "Failed to register shelter");
      },
    });
  };

  const handleUpdateCapacity = (id, data) => {
    updateMutation.mutate({ id, data });
  };

  const openShelters = shelters?.filter((s) => s.status === "open").length || 0;
  const totalCapacity =
    shelters?.reduce((sum, s) => sum + (s.capacity?.total || 0), 0) || 0;
  const currentOccupancy =
    shelters?.reduce((sum, s) => sum + (s.capacity?.current || 0), 0) || 0;

  return (
    <div className="shelter-management-panel">
      <div className="panel-header">
        <div className="header-title">
          <Home size={20} />
          <h3>{t("shelter.title")}</h3>
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
            className="btn-add"
            onClick={() => {
              console.log("Add Shelter button clicked, opening modal");
              setShowAddForm(true);
            }}
          >
            <Plus size={16} />
            {t("shelter.addShelter")}
          </button>
        </div>
      </div>

      <div className="stats-summary">
        <div className="stat-item">
          <span className="stat-value">{openShelters}</span>
          <span className="stat-label">{t("shelter.openShelters")}</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{currentOccupancy}</span>
          <span className="stat-label">{t("shelter.currentOccupancy")}</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{totalCapacity}</span>
          <span className="stat-label">{t("shelter.totalCapacity")}</span>
        </div>
      </div>

      <Modal
        isOpen={showAddForm}
        onClose={() => setShowAddForm(false)}
        title={t("shelter.registerShelter")}
        hideFooter
      >
        <AddShelterForm
          onSubmit={handleAddShelter}
          onCancel={() => setShowAddForm(false)}
          currentLocation={currentLocation}
          isSubmitting={createMutation.isPending}
        />
      </Modal>

      <div className="filter-tabs">
        {["all", "open", "full", "closing", "closed"].map((f) => (
          <button
            key={f}
            className={`filter-tab ${filter === f ? "active" : ""}`}
            onClick={() => setFilter(f)}
          >
            {t(`shelter.filter${f.charAt(0).toUpperCase() + f.slice(1)}`)}
          </button>
        ))}
      </div>

      <div className="shelters-list">
        {isLoading ? (
          <div className="loading-state">
            <RefreshCw className="spin" size={20} />
            <span>{t("common.loading")}</span>
          </div>
        ) : shelters?.length === 0 ? (
          <div className="empty-state">
            <Home size={32} />
            <p>{t("shelter.noShelters")}</p>
            <span>{t("shelter.noSheltersHint")}</span>
          </div>
        ) : (
          shelters.map((shelter) => (
            <ShelterCard
              key={shelter._id}
              shelter={shelter}
              onEdit={(s) => {
                setSelectedShelter(s);
                setShowEditModal(true);
              }}
              onUpdate={(s) => {
                setSelectedShelter(s);
                setShowCapacityModal(true);
              }}
            />
          ))
        )}
      </div>

      {/* Edit Shelter Modal */}
      <Modal
        isOpen={showEditModal && selectedShelter}
        onClose={() => {
          setShowEditModal(false);
          setSelectedShelter(null);
        }}
        title={`${t("common.edit")}: ${selectedShelter?.name || ''}`}
        hideFooter
      >
        {selectedShelter && (
          <EditShelterForm
            shelter={selectedShelter}
            onSubmit={(data) => {
              updateMutation.mutate({ id: selectedShelter._id, data }, {
                onSuccess: () => {
                  setShowEditModal(false);
                  setSelectedShelter(null);
                },
                onError: (err) => {
                  console.error("Error updating shelter:", err);
                  alert(err?.response?.data?.message || "Failed to update shelter");
                }
              });
            }}
            onCancel={() => {
              setShowEditModal(false);
              setSelectedShelter(null);
            }}
            isSubmitting={updateMutation.isPending}
          />
        )}
      </Modal>

      {showCapacityModal && selectedShelter && (
        <UpdateCapacityModal
          shelter={selectedShelter}
          onUpdate={handleUpdateCapacity}
          onClose={() => {
            setShowCapacityModal(false);
            setSelectedShelter(null);
          }}
          t={t}
        />
      )}
    </div>
  );
}

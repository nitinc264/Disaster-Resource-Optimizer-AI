import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Users,
  Search,
  Plus,
  X,
  Camera,
  MapPin,
  Clock,
  Phone,
  CheckCircle,
  AlertCircle,
  Heart,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Eye,
  Share2,
  User,
  FileText,
} from "lucide-react";
import { missingPersonsAPI } from "../services/apiService";
import "./MissingPersons.css";

const StatusBadge = ({ status }) => {
  const statusConfig = {
    missing: { color: "status-missing", icon: AlertCircle, label: "Missing" },
    found: { color: "status-found", icon: CheckCircle, label: "Found" },
    reunited: { color: "status-reunited", icon: Heart, label: "Reunited" },
    searching: { color: "status-searching", icon: Search, label: "Searching" },
  };

  const config = statusConfig[status] || statusConfig.missing;
  const Icon = config.icon;

  return (
    <span className={`status-badge ${config.color}`}>
      <Icon size={12} />
      {config.label}
    </span>
  );
};

const PersonCard = ({ person, onView, onMarkFound }) => {
  const [expanded, setExpanded] = useState(false);
  const { t } = useTranslation();

  const timeAgo = (date) => {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor(seconds / 3600);

    if (days > 0) return `${days} day${days > 1 ? "s" : ""} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
    return "Recently";
  };

  return (
    <div
      className={`person-card ${person.status} ${expanded ? "expanded" : ""}`}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="person-card-content">
        <div className="person-photo-wrapper">
          {person.photos && person.photos.length > 0 ? (
            <img src={person.photos[0]} alt={person.fullName} />
          ) : (
            <User size={24} />
          )}
        </div>

        <div className="person-info-main">
          <div className="person-header-row">
            <h4 className="person-name">{person.fullName}</h4>
            <StatusBadge status={person.status} />
          </div>

          <div className="person-demographics">
            <span>{person.age} yrs</span>
            <span className="separator">•</span>
            <span className="capitalize">{person.gender}</span>
          </div>

          <div className="person-location-row">
            <MapPin size={14} />
            <span className="location-text">
              {person.lastSeenLocation?.address || "Unknown location"}
            </span>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="person-body">
          <div className="person-details-grid">
            <div className="detail-item">
              <span className="detail-label">Reported</span>
              <div className="detail-value">
                <Clock size={14} />
                <span>{timeAgo(person.createdAt)}</span>
              </div>
            </div>

            {person.description && (
              <div className="detail-item full-width">
                <span className="detail-label">Description</span>
                <p className="detail-text">{person.description}</p>
              </div>
            )}

            {person.medicalInfo && (
              <div className="detail-item full-width alert">
                <span className="detail-label">Medical Info</span>
                <p className="detail-text">{person.medicalInfo}</p>
              </div>
            )}

            {person.reporterInfo && (
              <div className="detail-item full-width">
                <span className="detail-label">Contact</span>
                <div className="detail-value">
                  <Phone size={14} />
                  <span>
                    {person.reporterInfo.phone || "No phone provided"}
                  </span>
                </div>
              </div>
            )}
          </div>

          {person.photos && person.photos.length > 1 && (
            <div className="photos-gallery">
              {person.photos.map((photo, index) => (
                <img
                  key={index}
                  src={photo}
                  alt={`${person.fullName} ${index + 1}`}
                />
              ))}
            </div>
          )}

          <div className="person-actions">
            <button
              className="btn-view"
              onClick={(e) => {
                e.stopPropagation();
                onView(person);
              }}
            >
              <Eye size={14} />
              Details
            </button>
            <button
              className="btn-share"
              onClick={(e) => {
                e.stopPropagation();
              }}
            >
              <Share2 size={14} />
              Share
            </button>
            {person.status === "missing" && (
              <button
                className="btn-found"
                onClick={(e) => {
                  e.stopPropagation();
                  onMarkFound(person._id);
                }}
              >
                <CheckCircle size={14} />
                Found
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const ReportMissingForm = ({ onSubmit, onCancel, currentLocation }) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    fullName: "",
    age: "",
    gender: "unknown",
    description: "",
    medicalInfo: "",
    lastSeenAddress: "",
    reporterName: "",
    reporterPhone: "",
    relationship: "",
  });
  const [photos, setPhotos] = useState([]);

  const handlePhotoChange = (e) => {
    const files = Array.from(e.target.files);
    const previews = files.map((file) => URL.createObjectURL(file));
    setPhotos([...photos, ...previews]);
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const report = {
      fullName: formData.fullName,
      age: parseInt(formData.age) || 0,
      gender: formData.gender,
      description: formData.description,
      medicalInfo: formData.medicalInfo,
      lastSeenLocation: {
        address: formData.lastSeenAddress,
        point: currentLocation
          ? {
              type: "Point",
              coordinates: [currentLocation.lng, currentLocation.lat],
            }
          : undefined,
      },
      reporterInfo: {
        name: formData.reporterName,
        phone: formData.reporterPhone,
        relationship: formData.relationship,
      },
    };

    onSubmit(report);
  };

  return (
    <div className="missing-form-container">
      {/* Header */}
      <div className="missing-form-header">
        <button type="button" className="form-close-btn" onClick={onCancel}>
          <X size={20} />
        </button>
        <div className="form-header-content">
          <div className="form-header-icon">
            <Search size={28} />
          </div>
          <h2>Report Missing Person</h2>
          <p>Help reunite families by reporting missing persons</p>
        </div>
      </div>

      <form className="missing-form-body" onSubmit={handleSubmit}>
        {/* Person Information Section */}
        <div className="form-card">
          <div className="form-card-header">
            <User size={18} />
            <span>Person Information</span>
          </div>

          <div className="form-card-body">
            <div className="input-group">
              <label className="input-label">
                <User size={14} />
                Full Name <span className="required">*</span>
              </label>
              <input
                type="text"
                className="form-input"
                value={formData.fullName}
                onChange={(e) =>
                  setFormData({ ...formData, fullName: e.target.value })
                }
                placeholder="Enter the person's full name"
                required
              />
            </div>

            <div className="input-row">
              <div className="input-group">
                <label className="input-label">Age</label>
                <input
                  type="number"
                  className="form-input"
                  value={formData.age}
                  onChange={(e) =>
                    setFormData({ ...formData, age: e.target.value })
                  }
                  placeholder="Age"
                  min="0"
                  max="150"
                />
              </div>

              <div className="input-group">
                <label className="input-label">Gender</label>
                <select
                  className="form-input form-select"
                  value={formData.gender}
                  onChange={(e) =>
                    setFormData({ ...formData, gender: e.target.value })
                  }
                >
                  <option value="unknown">Unknown</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            <div className="input-group">
              <label className="input-label">
                <FileText size={14} />
                Description
              </label>
              <textarea
                className="form-input form-textarea"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Physical description, clothing, distinguishing features..."
                rows={3}
              />
            </div>

            <div className="input-group">
              <label className="input-label">
                <AlertCircle size={14} />
                Medical Information
              </label>
              <textarea
                className="form-input form-textarea"
                value={formData.medicalInfo}
                onChange={(e) =>
                  setFormData({ ...formData, medicalInfo: e.target.value })
                }
                placeholder="Medical conditions, medications, special needs..."
                rows={2}
              />
            </div>
          </div>
        </div>

        {/* Last Seen Location Section */}
        <div className="form-card">
          <div className="form-card-header">
            <MapPin size={18} />
            <span>Last Seen Location</span>
          </div>

          <div className="form-card-body">
            <div className="input-group">
              <label className="input-label">
                <MapPin size={14} />
                Location / Address
              </label>
              <textarea
                className="form-input form-textarea"
                value={formData.lastSeenAddress}
                onChange={(e) =>
                  setFormData({ ...formData, lastSeenAddress: e.target.value })
                }
                placeholder="Where was the person last seen?"
                rows={2}
              />
            </div>

            {currentLocation && (
              <div className="location-detected">
                <MapPin size={14} />
                <span>
                  Your location detected: {currentLocation.lat.toFixed(4)},{" "}
                  {currentLocation.lng.toFixed(4)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Photo Upload Section */}
        <div className="form-card">
          <div className="form-card-header">
            <Camera size={18} />
            <span>Photos</span>
            <span className="optional-badge">Optional</span>
          </div>

          <div className="form-card-body">
            <div className="photo-upload-area">
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handlePhotoChange}
                id="missing-photo-input"
                hidden
              />
              <label htmlFor="missing-photo-input" className="photo-upload-btn">
                <Camera size={24} />
                <span>Add Photos</span>
                <span className="upload-hint">
                  Upload recent photos to help identify
                </span>
              </label>
            </div>

            {photos.length > 0 && (
              <div className="photo-preview-grid">
                {photos.map((photo, index) => (
                  <div key={index} className="photo-preview-item">
                    <img src={photo} alt={`Preview ${index + 1}`} />
                    <button
                      type="button"
                      className="photo-remove-btn"
                      onClick={() =>
                        setPhotos(photos.filter((_, i) => i !== index))
                      }
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Reporter Information Section */}
        <div className="form-card">
          <div className="form-card-header">
            <Phone size={18} />
            <span>Your Contact Information</span>
          </div>

          <div className="form-card-body">
            <div className="input-group">
              <label className="input-label">
                <User size={14} />
                Your Name <span className="required">*</span>
              </label>
              <input
                type="text"
                className="form-input"
                value={formData.reporterName}
                onChange={(e) =>
                  setFormData({ ...formData, reporterName: e.target.value })
                }
                placeholder="Your name"
              />
            </div>

            <div className="input-group">
              <label className="input-label">
                <Phone size={14} />
                Phone Number <span className="required">*</span>
              </label>
              <input
                type="tel"
                className="form-input"
                value={formData.reporterPhone}
                onChange={(e) =>
                  setFormData({ ...formData, reporterPhone: e.target.value })
                }
                placeholder="+1 234 567 8900"
              />
            </div>

            <div className="input-group">
              <label className="input-label">Relationship to Person</label>
              <input
                type="text"
                className="form-input"
                value={formData.relationship}
                onChange={(e) =>
                  setFormData({ ...formData, relationship: e.target.value })
                }
                placeholder="Family member, friend, witness, etc."
              />
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          className="submit-report-btn"
          disabled={!formData.fullName}
        >
          <Search size={20} />
          Submit Missing Person Report
        </button>
      </form>
    </div>
  );
};

export default function MissingPersons({ currentLocation }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [showReportForm, setShowReportForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [filter, setFilter] = useState("all");

  // Fetch missing persons
  const {
    data: persons,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["missingPersons", filter, searchQuery],
    queryFn: () =>
      missingPersonsAPI.getAll({
        status: filter !== "all" ? filter : undefined,
        search: searchQuery || undefined,
      }),
    select: (response) => response?.data?.data || [],
    refetchInterval: 60000, // Refresh every minute
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data) => missingPersonsAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(["missingPersons"]);
      setShowReportForm(false);
    },
  });

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }) => missingPersonsAPI.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries(["missingPersons"]);
    },
  });

  const handleReportSubmit = (data) => {
    createMutation.mutate(data);
  };

  const handleMarkFound = (id) => {
    updateStatusMutation.mutate({ id, status: "found" });
  };

  const missingCount =
    persons?.filter((p) => p.status === "missing").length || 0;

  return (
    <div className="missing-persons-panel">
      <div className="panel-header">
        <div className="header-title">
          <Users size={20} />
          <h3>Family Reunification</h3>
          {missingCount > 0 && (
            <span className="missing-count">{missingCount} missing</span>
          )}
        </div>
        <div className="header-actions">
          <button
            className="btn-refresh"
            onClick={() => refetch()}
            title="Refresh"
          >
            <RefreshCw size={16} />
          </button>
          <button
            className="btn-report"
            onClick={() => setShowReportForm(!showReportForm)}
          >
            {showReportForm ? <X size={16} /> : <Plus size={16} />}
            {showReportForm ? "Cancel" : "Report Missing"}
          </button>
        </div>
      </div>

      {showReportForm ? (
        <ReportMissingForm
          onSubmit={handleReportSubmit}
          onCancel={() => setShowReportForm(false)}
          currentLocation={currentLocation}
        />
      ) : (
        <>
          <div className="search-bar">
            <Search size={16} />
            <input
              type="text"
              placeholder="Search by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                className="clear-search"
                onClick={() => setSearchQuery("")}
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="filter-tabs">
            {["all", "missing", "found", "reunited"].map((f) => (
              <button
                key={f}
                className={`filter-tab ${filter === f ? "active" : ""}`}
                onClick={() => setFilter(f)}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>

          <div className="persons-list">
            {isLoading ? (
              <div className="loading-state">
                <RefreshCw className="spin" size={20} />
                <span>Loading registry...</span>
              </div>
            ) : persons?.length === 0 ? (
              <div className="empty-state">
                <Heart size={32} />
                <p>No reports found</p>
                <span>
                  {searchQuery
                    ? "Try a different search term"
                    : "Report missing persons to help reunite families"}
                </span>
              </div>
            ) : (
              persons.map((person) => (
                <PersonCard
                  key={person._id}
                  person={person}
                  onView={(p) => setSelectedPerson(p)}
                  onMarkFound={handleMarkFound}
                />
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

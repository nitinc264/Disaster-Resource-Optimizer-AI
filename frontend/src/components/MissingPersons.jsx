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

const PersonDetailModal = ({ person, onClose, onMarkFound }) => {
  const { t } = useTranslation();

  if (!person) return null;

  const timeAgo = (date) => {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor(seconds / 3600);

    if (days > 0)
      return t("reports.daysAgo", {
        count: days,
        defaultValue: `${days} day${days > 1 ? "s" : ""} ago`,
      });
    if (hours > 0)
      return t("reports.hoursAgo", {
        count: hours,
        defaultValue: `${hours} hour${hours > 1 ? "s" : ""} ago`,
      });
    return t("reports.justNow");
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{person.fullName}</h3>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className="modal-body">
          {person.photos && person.photos.length > 0 && (
            <div className="modal-photo">
              <img src={person.photos[0].url || person.photos[0]} alt={person.fullName} />
            </div>
          )}
          <div className="modal-details">
            <div className="detail-row">
              <strong>{t("family.status")}:</strong>
              <StatusBadge status={person.status} t={t} />
            </div>
            <div className="detail-row">
              <strong>{t("family.age")}:</strong>
              <span>{person.age} {t("missingPerson.years")}</span>
            </div>
            <div className="detail-row">
              <strong>{t("family.gender")}:</strong>
              <span className="capitalize">{person.gender}</span>
            </div>
            <div className="detail-row">
              <strong>{t("family.lastSeenLocation")}:</strong>
              <span>{person.lastSeenLocation?.address || t("tasks.noLocation")}</span>
            </div>
            <div className="detail-row">
              <strong>{t("family.reported")}:</strong>
              <span>{timeAgo(person.createdAt)}</span>
            </div>
            {person.description && (
              <div className="detail-row">
                <strong>{t("family.description")}:</strong>
                <p>{typeof person.description === "string" ? person.description : person.description.physical || ""}</p>
              </div>
            )}
            {person.medicalInfo && (
              <div className="detail-row alert">
                <strong>{t("family.medicalInfo")}:</strong>
                <p>{person.medicalInfo}</p>
              </div>
            )}
            {person.reporterInfo && (
              <div className="detail-row">
                <strong>{t("family.contact")}:</strong>
                <span>{person.reporterInfo.phone || t("family.noPhone")}</span>
              </div>
            )}
          </div>
          {person.status === "missing" && (
            <div className="modal-actions">
              <button
                className="btn-found"
                onClick={() => {
                  onMarkFound(person._id);
                  onClose();
                }}
              >
                <CheckCircle size={16} />
                {t("family.markFound")}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const StatusBadge = ({ status, t }) => {
  const statusConfig = {
    missing: {
      color: "status-missing",
      icon: AlertCircle,
      key: "family.statusMissing",
    },
    found: {
      color: "status-found",
      icon: CheckCircle,
      key: "family.statusFound",
    },
    reunited: {
      color: "status-reunited",
      icon: Heart,
      key: "family.statusReunited",
    },
    searching: {
      color: "status-searching",
      icon: Search,
      key: "family.statusSearching",
    },
  };

  const config = statusConfig[status] || statusConfig.missing;
  const Icon = config.icon;

  return (
    <span className={`status-badge ${config.color}`}>
      <Icon size={12} />
      {t(config.key)}
    </span>
  );
};

const PersonCard = ({ person, onView, onMarkFound }) => {
  const [expanded, setExpanded] = useState(false);
  const { t } = useTranslation();

  const handleShare = async () => {
    const shareText = `${t("family.missing")}: ${person.fullName}, ${person.age} ${t("missingPerson.years")}, ${person.gender}. ${t("family.lastSeenLocation")}: ${person.lastSeenLocation?.address || t("tasks.noLocation")}. ${t("family.contact")}: ${person.reporterInfo?.phone || ""}`;
    const shareUrl = window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `${t("family.missing")}: ${person.fullName}`,
          text: shareText,
          url: shareUrl,
        });
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error("Share failed:", err);
        }
      }
    } else {
      try {
        await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
        alert(t("family.copiedToClipboard") || "Copied to clipboard!");
      } catch (err) {
        console.error("Clipboard copy failed:", err);
      }
    }
  };

  const timeAgo = (date) => {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor(seconds / 3600);

    if (days > 0)
      return t("reports.daysAgo", {
        count: days,
        defaultValue: `${days} day${days > 1 ? "s" : ""} ago`,
      });
    if (hours > 0)
      return t("reports.hoursAgo", {
        count: hours,
        defaultValue: `${hours} hour${hours > 1 ? "s" : ""} ago`,
      });
    return t("reports.justNow");
  };

  return (
    <div
      className={`person-card ${person.status} ${expanded ? "expanded" : ""}`}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="person-card-content">
        <div className="person-photo-wrapper">
          {person.photos && person.photos.length > 0 ? (
            <img
              src={person.photos[0].url || person.photos[0]}
              alt={person.fullName}
            />
          ) : (
            <User size={24} />
          )}
        </div>

        <div className="person-info-main">
          <div className="person-header-row">
            <h4 className="person-name">{person.fullName}</h4>
            <StatusBadge status={person.status} t={t} />
          </div>

          <div className="person-demographics">
            <span>
              {person.age} {t("missingPerson.years", "yrs")}
            </span>
            <span className="separator">•</span>
            <span className="capitalize">{person.gender}</span>
          </div>

          <div className="person-location-row">
            <MapPin size={14} />
            <span className="location-text">
              {person.lastSeenLocation?.address ||
                t("tasks.noLocation", "Unknown location")}
            </span>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="person-body">
          <div className="person-details-grid">
            <div className="detail-item">
              <span className="detail-label">{t("family.reported")}</span>
              <div className="detail-value">
                <Clock size={14} />
                <span>{timeAgo(person.createdAt)}</span>
              </div>
            </div>

            {person.description && (
              <div className="detail-item full-width">
                <span className="detail-label">{t("family.description")}</span>
                <p className="detail-text">
                  {typeof person.description === "string"
                    ? person.description
                    : person.description.physical || ""}
                </p>
              </div>
            )}

            {person.medicalInfo && (
              <div className="detail-item full-width alert">
                <span className="detail-label">{t("family.medicalInfo")}</span>
                <p className="detail-text">{person.medicalInfo}</p>
              </div>
            )}

            {person.reporterInfo && (
              <div className="detail-item full-width">
                <span className="detail-label">{t("family.contact")}</span>
                <div className="detail-value">
                  <Phone size={14} />
                  <span>
                    {person.reporterInfo.phone || t("family.noPhone")}
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
                  src={photo.url || photo}
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
              {t("family.details")}
            </button>
            <button
              className="btn-share"
              onClick={(e) => {
                e.stopPropagation();
                handleShare();
              }}
            >
              <Share2 size={14} />
              {t("family.share")}
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
                {t("family.markFound")}
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
  const [photos, setPhotos] = useState([]); // Stores { file, preview } objects
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handlePhotoChange = (e) => {
    const files = Array.from(e.target.files);
    const newPhotos = files.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));
    setPhotos([...photos, ...newPhotos]);
  };

  const removePhoto = (index) => {
    // Revoke object URL to prevent memory leak
    URL.revokeObjectURL(photos[index].preview);
    setPhotos(photos.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Create FormData for multipart upload
      const submitData = new FormData();

      // Prepare the data object
      const reportData = {
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

      // Add data as JSON string
      submitData.append("data", JSON.stringify(reportData));

      // Add photo file if exists (only first photo for now)
      if (photos.length > 0 && photos[0].file) {
        submitData.append("photo", photos[0].file);
      }

      await onSubmit(submitData);
    } catch (error) {
      console.error("Form submission error:", error);
    } finally {
      setIsSubmitting(false);
    }
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
          <h2>{t("family.reportMissing")}</h2>
          <p>{t("family.reportMissingHint")}</p>
        </div>
      </div>

      <form className="missing-form-body" onSubmit={handleSubmit}>
        {/* Person Information Section */}
        <div className="form-card">
          <div className="form-card-header">
            <User size={18} />
            <span>{t("family.personInfo")}</span>
          </div>

          <div className="form-card-body">
            <div className="input-group">
              <label className="input-label">
                <User size={14} />
                {t("family.fullName")} <span className="required">*</span>
              </label>
              <input
                type="text"
                className="form-input"
                value={formData.fullName}
                onChange={(e) =>
                  setFormData({ ...formData, fullName: e.target.value })
                }
                placeholder={t("family.fullNamePlaceholder")}
                required
              />
            </div>

            <div className="input-row">
              <div className="input-group">
                <label className="input-label">{t("family.age")}</label>
                <input
                  type="number"
                  className="form-input"
                  value={formData.age}
                  onChange={(e) =>
                    setFormData({ ...formData, age: e.target.value })
                  }
                  placeholder={t("family.age")}
                  min="0"
                  max="150"
                />
              </div>

              <div className="input-group">
                <label className="input-label">{t("family.gender")}</label>
                <select
                  className="form-input form-select"
                  value={formData.gender}
                  onChange={(e) =>
                    setFormData({ ...formData, gender: e.target.value })
                  }
                >
                  <option value="unknown">{t("family.genderUnknown")}</option>
                  <option value="male">{t("family.genderMale")}</option>
                  <option value="female">{t("family.genderFemale")}</option>
                  <option value="other">{t("family.genderOther")}</option>
                </select>
              </div>
            </div>

            <div className="input-group">
              <label className="input-label">
                <FileText size={14} />
                {t("family.description")}
              </label>
              <textarea
                className="form-input form-textarea"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder={t("family.descriptionPlaceholder")}
                rows={3}
              />
            </div>

            <div className="input-group">
              <label className="input-label">
                <AlertCircle size={14} />
                {t("family.medicalInfo")}
              </label>
              <textarea
                className="form-input form-textarea"
                value={formData.medicalInfo}
                onChange={(e) =>
                  setFormData({ ...formData, medicalInfo: e.target.value })
                }
                placeholder={t("family.medicalPlaceholder")}
                rows={2}
              />
            </div>
          </div>
        </div>

        {/* Last Seen Location Section */}
        <div className="form-card">
          <div className="form-card-header">
            <MapPin size={18} />
            <span>{t("family.lastSeenLocation")}</span>
          </div>

          <div className="form-card-body">
            <div className="input-group">
              <label className="input-label">
                <MapPin size={14} />
                {t("family.locationAddress")}
              </label>
              <textarea
                className="form-input form-textarea"
                value={formData.lastSeenAddress}
                onChange={(e) =>
                  setFormData({ ...formData, lastSeenAddress: e.target.value })
                }
                placeholder={t("family.locationPlaceholder")}
                rows={2}
              />
            </div>

            {currentLocation && (
              <div className="location-detected">
                <MapPin size={14} />
                <span>
                  {t("family.locationDetected")}:{" "}
                  {currentLocation.lat.toFixed(4)},{" "}
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
            <span>{t("family.photos")}</span>
            <span className="optional-badge">{t("family.optional")}</span>
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
                <span>{t("family.addPhotos")}</span>
                <span className="upload-hint">{t("family.uploadHint")}</span>
              </label>
            </div>

            {photos.length > 0 && (
              <div className="photo-preview-grid">
                {photos.map((photo, index) => (
                  <div key={index} className="photo-preview-item">
                    <img src={photo.preview} alt={`Preview ${index + 1}`} />
                    <button
                      type="button"
                      className="photo-remove-btn"
                      onClick={() => removePhoto(index)}
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
            <span>{t("family.yourContact")}</span>
          </div>

          <div className="form-card-body">
            <div className="input-group">
              <label className="input-label">
                <User size={14} />
                {t("family.yourName")} <span className="required">*</span>
              </label>
              <input
                type="text"
                className="form-input"
                value={formData.reporterName}
                onChange={(e) =>
                  setFormData({ ...formData, reporterName: e.target.value })
                }
                placeholder={t("family.yourName")}
              />
            </div>

            <div className="input-group">
              <label className="input-label">
                <Phone size={14} />
                {t("family.phoneNumber")} <span className="required">*</span>
              </label>
              <input
                type="tel"
                className="form-input"
                value={formData.reporterPhone}
                onChange={(e) =>
                  setFormData({ ...formData, reporterPhone: e.target.value })
                }
                placeholder="+91 98765 43210"
              />
            </div>

            <div className="input-group">
              <label className="input-label">{t("family.relationship")}</label>
              <input
                type="text"
                className="form-input"
                value={formData.relationship}
                onChange={(e) =>
                  setFormData({ ...formData, relationship: e.target.value })
                }
                placeholder={t("family.relationshipPlaceholder")}
              />
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          className="submit-report-btn"
          disabled={!formData.fullName || isSubmitting}
        >
          {isSubmitting ? (
            <>
              <RefreshCw size={20} className="spin" />
              {t("family.submitting", "Submitting...")}
            </>
          ) : (
            <>
              <Search size={20} />
              {t("family.submitReport")}
            </>
          )}
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
    mutationFn: ({ id, status }) => {
      console.log("Marking person as found:", id, status);
      return missingPersonsAPI.updateStatus(id, status);
    },
    onSuccess: (data) => {
      console.log("Successfully marked as found:", data);
      queryClient.invalidateQueries(["missingPersons"]);
      alert(t("family.markedAsFound") || "Person marked as found!");
    },
    onError: (error) => {
      console.error("Error marking as found:", error);
      alert(t("family.errorMarkingFound") || `Error: ${error.message || "Failed to mark as found"}`);
    },
  });

  const handleReportSubmit = (data) => {
    createMutation.mutate(data);
  };

  const handleMarkFound = (id) => {
    if (!id) {
      console.error("No ID provided to handleMarkFound");
      return;
    }
    console.log("handleMarkFound called with id:", id);
    updateStatusMutation.mutate({ id, status: "found" });
  };

  const missingCount =
    persons?.filter((p) => p.status === "missing").length || 0;

  return (
    <div className="missing-persons-panel">
      <div className="panel-header">
        <div className="header-title">
          <Users size={20} />
          <h3>{t("family.title")}</h3>
          {missingCount > 0 && (
            <span className="missing-count">
              {missingCount} {t("family.filterMissing").toLowerCase()}
            </span>
          )}
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
            className="btn-report"
            onClick={() => setShowReportForm(!showReportForm)}
          >
            {showReportForm ? <X size={16} /> : <Plus size={16} />}
            {showReportForm ? t("common.cancel") : t("family.reportMissing")}
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
              placeholder={t("family.searchPlaceholder")}
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
                {t(`family.filter${f.charAt(0).toUpperCase() + f.slice(1)}`)}
              </button>
            ))}
          </div>

          <div className="persons-list">
            {isLoading ? (
              <div className="loading-state">
                <RefreshCw className="spin" size={20} />
                <span>{t("family.loading")}</span>
              </div>
            ) : persons?.length === 0 ? (
              <div className="empty-state">
                <Heart size={32} />
                <p>{t("family.noReports")}</p>
                <span>
                  {searchQuery
                    ? t("family.tryDifferentSearch")
                    : t("family.noReportsHint")}
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

      {selectedPerson && (
        <PersonDetailModal
          person={selectedPerson}
          onClose={() => setSelectedPerson(null)}
          onMarkFound={handleMarkFound}
        />
      )}
    </div>
  );
}

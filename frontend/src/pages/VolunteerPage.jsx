import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  ClipboardList,
  Mic,
  Camera,
  Search,
  MapPin,
  Phone,
  User,
  AlertCircle,
  CheckCircle,
  Loader2,
  X,
} from "lucide-react";
import {
  AudioReporter,
  PhotoReporter,
  VolunteerTaskList,
  FloatingSOSButton,
} from "../components";
import { missingPersonsAPI } from "../services/apiService";
import "./VolunteerPage.css";

// Missing Person Report Form Component
function MissingPersonReport() {
  const { t } = useTranslation();
  const [currentLocation, setCurrentLocation] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    fullName: "",
    age: "",
    gender: "unknown",
    description: "",
    lastSeenAddress: "",
    reporterName: "",
    reporterPhone: "",
  });
  const [photos, setPhotos] = useState([]);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          setCurrentLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          }),
        () => setCurrentLocation(null)
      );
    }
  }, []);

  const handlePhotoChange = (e) => {
    const files = Array.from(e.target.files);
    const newPhotos = files.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));
    setPhotos([...photos, ...newPhotos]);
  };

  const removePhoto = (index) => {
    URL.revokeObjectURL(photos[index].preview);
    setPhotos(photos.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      // Create FormData for multipart upload
      const submitData = new FormData();

      const report = {
        fullName: formData.fullName,
        age: parseInt(formData.age) || 0,
        gender: formData.gender,
        description: { physical: formData.description },
        lastSeenLocation: {
          address: formData.lastSeenAddress,
          point: currentLocation
            ? {
                type: "Point",
                coordinates: [currentLocation.lng, currentLocation.lat],
              }
            : undefined,
        },
        lastSeenDate: new Date().toISOString(),
        reporterInfo: {
          name: formData.reporterName,
          phone: formData.reporterPhone,
        },
      };

      // Add data as JSON string
      submitData.append("data", JSON.stringify(report));

      // Add photo file if exists
      if (photos.length > 0 && photos[0].file) {
        submitData.append("photo", photos[0].file);
      }

      await missingPersonsAPI.report(submitData);
      setSuccess(true);

      // Clean up photo previews
      photos.forEach((photo) => URL.revokeObjectURL(photo.preview));

      setFormData({
        fullName: "",
        age: "",
        gender: "unknown",
        description: "",
        lastSeenAddress: "",
        reporterName: "",
        reporterPhone: "",
      });
      setPhotos([]);
      setTimeout(() => setSuccess(false), 5000);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to submit report");
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="missing-success">
        <CheckCircle size={48} />
        <h3>{t("missingPerson.success.title")}</h3>
        <p>
          {t("missingPerson.success.message")}
        </p>
        <button onClick={() => setSuccess(false)} className="btn-primary">
          {t("missingPerson.success.button")}
        </button>
      </div>
    );
  }

  return (
    <form className="missing-report-form" onSubmit={handleSubmit}>
      <div className="form-header">
        <Search size={24} />
        <div>
          <h3>{t("missingPerson.title")}</h3>
          <p>{t("missingPerson.subtitle")}</p>
        </div>
      </div>

      {error && (
        <div className="form-error">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      <div className="form-section">
        <h4>{t("missingPerson.personInfo")}</h4>

        <div className="form-group">
          <label>
            <User size={14} /> {t("missingPerson.fullName")} *
          </label>
          <input
            type="text"
            value={formData.fullName}
            onChange={(e) =>
              setFormData({ ...formData, fullName: e.target.value })
            }
            placeholder={t("missingPerson.fullNamePlaceholder")}
            required
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>{t("missingPerson.age")}</label>
            <input
              type="number"
              value={formData.age}
              onChange={(e) =>
                setFormData({ ...formData, age: e.target.value })
              }
              placeholder={t("missingPerson.age")}
              min="0"
              max="150"
            />
          </div>
          <div className="form-group">
            <label>{t("missingPerson.gender")}</label>
            <select
              value={formData.gender}
              onChange={(e) =>
                setFormData({ ...formData, gender: e.target.value })
              }
            >
              <option value="unknown">
                {t("missingPerson.genderUnknown")}
              </option>
              <option value="male">{t("missingPerson.genderMale")}</option>
              <option value="female">{t("missingPerson.genderFemale")}</option>
              <option value="other">{t("missingPerson.genderOther")}</option>
            </select>
          </div>
        </div>

        <div className="form-group">
          <label>{t("missingPerson.description")}</label>
          <textarea
            value={formData.description}
            onChange={(e) =>
              setFormData({ ...formData, description: e.target.value })
            }
            placeholder={t("missingPerson.descriptionPlaceholder")}
            rows={3}
          />
        </div>

        <div className="form-group">
          <label>
            <Camera size={14} /> {t("missingPerson.photo")}
          </label>
          <div className="photo-upload-area">
            <input
              type="file"
              accept="image/*"
              onChange={handlePhotoChange}
              id="volunteer-missing-photo"
              hidden
            />
            <label
              htmlFor="volunteer-missing-photo"
              className="photo-upload-btn"
            >
              <Camera size={20} />
              <span>{t("missingPerson.addPhoto", "Add Photo")}</span>
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

      <div className="form-section">
        <h4>{t("missingPerson.lastSeen")}</h4>

        <div className="form-group">
          <label>
            <MapPin size={14} /> {t("missingPerson.locationAddress")}
          </label>
          <input
            type="text"
            value={formData.lastSeenAddress}
            onChange={(e) =>
              setFormData({ ...formData, lastSeenAddress: e.target.value })
            }
            placeholder={t("missingPerson.locationPlaceholder")}
          />
        </div>

        {currentLocation && (
          <div className="location-detected">
            <MapPin size={14} />
            <span>
              {t("missingPerson.locationDetected")}:{" "}
              {currentLocation.lat.toFixed(4)}, {currentLocation.lng.toFixed(4)}
            </span>
          </div>
        )}
      </div>

      <div className="form-section">
        <h4>{t("missingPerson.contactInfo")}</h4>

        <div className="form-group">
          <label>
            <User size={14} /> {t("missingPerson.yourName")} *
          </label>
          <input
            type="text"
            value={formData.reporterName}
            onChange={(e) =>
              setFormData({ ...formData, reporterName: e.target.value })
            }
            placeholder={t("missingPerson.yourNamePlaceholder")}
            required
          />
        </div>

        <div className="form-group">
          <label>
            <Phone size={14} /> {t("missingPerson.phone")} *
          </label>
          <input
            type="tel"
            value={formData.reporterPhone}
            onChange={(e) =>
              setFormData({ ...formData, reporterPhone: e.target.value })
            }
            placeholder={t("missingPerson.phonePlaceholder")}
            required
          />
        </div>
      </div>

      <button type="submit" className="btn-submit" disabled={submitting}>
        {submitting ? (
          <>
            <Loader2 size={18} className="spin" />
            {t("missingPerson.submitting")}
          </>
        ) : (
          <>
            <Search size={18} />
            {t("missingPerson.submit")}
          </>
        )}
      </button>
    </form>
  );
}

function VolunteerPage() {
  const { t } = useTranslation();
  const [viewMode, setViewMode] = useState("tasks"); // 'tasks' | 'voice' | 'photo' | 'missing'

  const tabs = [
    { id: "tasks", icon: ClipboardList, label: t("volunteer.myTasks") },
    { id: "voice", icon: Mic, label: t("volunteer.voiceReport") },
    { id: "photo", icon: Camera, label: t("volunteer.photoReport") },
    { id: "missing", icon: Search, label: t("volunteer.missingPerson") },
  ];

  return (
    <div className="volunteer-page">
      {/* Simple Header */}
      <header className="field-header">
        <h1>🚨 {t("volunteer.title")}</h1>
        <p>{t("volunteer.subtitle")}</p>
      </header>

      {/* Large, Easy-to-Tap Action Cards */}
      <nav className="action-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setViewMode(tab.id)}
            className={`action-tab ${viewMode === tab.id ? "active" : ""}`}
          >
            <tab.icon size={24} />
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>

      {/* Content Area */}
      <main className="field-content">
        {viewMode === "tasks" && <VolunteerTaskList />}
        {viewMode === "voice" && <AudioReporter />}
        {viewMode === "photo" && <PhotoReporter />}
        {viewMode === "missing" && <MissingPersonReport />}
      </main>

      {/* Floating SOS Button - always visible */}
      <FloatingSOSButton volunteerId="current-volunteer" />
    </div>
  );
}

export default VolunteerPage;

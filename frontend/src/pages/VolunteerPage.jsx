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
} from "lucide-react";
import {
  AudioReporter,
  PhotoReporter,
  VolunteerTaskList,
  FloatingSOSButton,
  NotificationBell,
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
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

      await missingPersonsAPI.report(report);
      setSuccess(true);
      setFormData({
        fullName: "",
        age: "",
        gender: "unknown",
        description: "",
        lastSeenAddress: "",
        reporterName: "",
        reporterPhone: "",
      });
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
        <h3>Report Submitted Successfully</h3>
        <p>
          Thank you for reporting. Our team will start searching immediately.
        </p>
        <button onClick={() => setSuccess(false)} className="btn-primary">
          Report Another
        </button>
      </div>
    );
  }

  return (
    <form className="missing-report-form" onSubmit={handleSubmit}>
      <div className="form-header">
        <Search size={24} />
        <div>
          <h3>Report Missing Person</h3>
          <p>Help reunite families by reporting missing persons</p>
        </div>
      </div>

      {error && (
        <div className="form-error">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      <div className="form-section">
        <h4>Person Information</h4>

        <div className="form-group">
          <label>
            <User size={14} /> Full Name *
          </label>
          <input
            type="text"
            value={formData.fullName}
            onChange={(e) =>
              setFormData({ ...formData, fullName: e.target.value })
            }
            placeholder="Enter the person's full name"
            required
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Age</label>
            <input
              type="number"
              value={formData.age}
              onChange={(e) =>
                setFormData({ ...formData, age: e.target.value })
              }
              placeholder="Age"
              min="0"
              max="150"
            />
          </div>
          <div className="form-group">
            <label>Gender</label>
            <select
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

        <div className="form-group">
          <label>Description</label>
          <textarea
            value={formData.description}
            onChange={(e) =>
              setFormData({ ...formData, description: e.target.value })
            }
            placeholder="Physical description, clothing, distinguishing features..."
            rows={3}
          />
        </div>
      </div>

      <div className="form-section">
        <h4>Last Seen Location</h4>

        <div className="form-group">
          <label>
            <MapPin size={14} /> Location / Address
          </label>
          <input
            type="text"
            value={formData.lastSeenAddress}
            onChange={(e) =>
              setFormData({ ...formData, lastSeenAddress: e.target.value })
            }
            placeholder="Where was the person last seen?"
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

      <div className="form-section">
        <h4>Your Contact Information</h4>

        <div className="form-group">
          <label>
            <User size={14} /> Your Name *
          </label>
          <input
            type="text"
            value={formData.reporterName}
            onChange={(e) =>
              setFormData({ ...formData, reporterName: e.target.value })
            }
            placeholder="Your name"
            required
          />
        </div>

        <div className="form-group">
          <label>
            <Phone size={14} /> Phone Number *
          </label>
          <input
            type="tel"
            value={formData.reporterPhone}
            onChange={(e) =>
              setFormData({ ...formData, reporterPhone: e.target.value })
            }
            placeholder="+1 234 567 8900"
            required
          />
        </div>
      </div>

      <button type="submit" className="btn-submit" disabled={submitting}>
        {submitting ? (
          <>
            <Loader2 size={18} className="spin" />
            Submitting...
          </>
        ) : (
          <>
            <Search size={18} />
            Submit Missing Person Report
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
    { id: "tasks", icon: ClipboardList, label: "My Tasks" },
    { id: "voice", icon: Mic, label: "Voice Report" },
    { id: "photo", icon: Camera, label: "Photo Report" },
    { id: "missing", icon: Search, label: "Missing Person" },
  ];

  return (
    <div className="volunteer-page">
      {/* Simple Header */}
      <header className="field-header">
        <div className="field-header-top">
          <h1>🚨 Field Operations</h1>
          <NotificationBell />
        </div>
        <p>Report incidents and manage your assigned tasks</p>
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

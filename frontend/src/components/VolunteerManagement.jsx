import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext";
import {
  registerVolunteer,
  getVolunteers,
  deactivateVolunteer,
  sendVolunteerMessage,
} from "../services/authService";
import {
  UserPlus,
  Users,
  Trash2,
  Copy,
  Check,
  AlertCircle,
  Loader2,
  Phone,
  Mail,
  Shield,
  MessageSquare,
  Send,
  X,
} from "lucide-react";
import Modal from "./Modal";
import "./VolunteerManagement.css";

const SKILL_OPTIONS = [
  "First Aid",
  "Search & Rescue",
  "Medical",
  "Driving",
  "Communication",
  "Logistics",
  "Construction",
  "Cooking",
  "Translation",
  "Counseling",
];

export default function VolunteerManagement() {
  const { t } = useTranslation();
  const { isManager } = useAuth();
  const [volunteers, setVolunteers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [newPin, setNewPin] = useState(null);
  const [copiedPin, setCopiedPin] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    skills: [],
  });
  const [messageModal, setMessageModal] = useState({
    open: false,
    volunteer: null,
  });
  const [messageText, setMessageText] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);

  useEffect(() => {
    if (isManager) {
      fetchVolunteers();
    }
  }, [isManager]);

  const fetchVolunteers = async () => {
    try {
      setLoading(true);
      const result = await getVolunteers();
      if (result.success) {
        setVolunteers(result.data);
      }
    } catch (err) {
      setError("Failed to load volunteers");
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSkillToggle = (skill) => {
    setFormData((prev) => ({
      ...prev,
      skills: prev.skills.includes(skill)
        ? prev.skills.filter((s) => s !== skill)
        : [...prev.skills, skill],
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSubmitting(true);

    try {
      const result = await registerVolunteer(formData);
      if (result.success) {
        setNewPin(result.data.pin);
        setSuccess(`Volunteer "${result.data.name}" registered successfully!`);
        setFormData({ name: "", phone: "", email: "", skills: [] });
        fetchVolunteers();
      } else {
        setError(result.message || "Registration failed");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Registration failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeactivate = async (id, name) => {
    if (!confirm(`Are you sure you want to deactivate ${name}?`)) return;

    try {
      const result = await deactivateVolunteer(id);
      if (result.success) {
        setSuccess(`Volunteer "${name}" deactivated`);
        fetchVolunteers();
      }
    } catch (err) {
      setError("Failed to deactivate volunteer");
    }
  };

  const copyPin = async () => {
    if (newPin) {
      await navigator.clipboard.writeText(newPin);
      setCopiedPin(true);
      setTimeout(() => setCopiedPin(false), 2000);
    }
  };

  const handleOpenMessage = (volunteer) => {
    setMessageModal({ open: true, volunteer });
    setMessageText("");
  };

  const handleCloseMessage = () => {
    setMessageModal({ open: false, volunteer: null });
    setMessageText("");
  };

  const handleSendMessage = async () => {
    if (!messageText.trim() || !messageModal.volunteer) return;

    setSendingMessage(true);
    try {
      const result = await sendVolunteerMessage(
        messageModal.volunteer._id,
        messageText
      );

      if (result.success) {
        setSuccess(`Message sent to ${messageModal.volunteer.name}`);
        handleCloseMessage();
      } else {
        setError("Failed to send message");
      }
    } catch (err) {
      setError("Failed to send message");
    } finally {
      setSendingMessage(false);
    }
  };

  if (!isManager) {
    return (
      <div className="volunteer-management">
        <div className="access-denied">
          <Shield size={48} />
          <h2>{t("volunteer.managerRequired")}</h2>
          <p>{t("volunteer.managerRequiredHint")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="volunteer-management">
      <div className="vm-header">
        <h2>
          <Users size={24} />
          {t("volunteer.management")}
        </h2>
        <button
          className="btn-add-volunteer"
          onClick={() => setShowForm(!showForm)}
        >
          <UserPlus size={18} />
          {showForm ? t("common.cancel") : t("volunteer.register")}
        </button>
      </div>

      {error && (
        <div className="vm-alert error">
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      {success && (
        <div className="vm-alert success">
          <Check size={18} />
          {success}
        </div>
      )}

      {newPin && (
        <div className="new-pin-card">
          <h3>{t("volunteer.newPinTitle")}</h3>
          <p>{t("volunteer.newPinHint")}</p>
          <div className="pin-display">
            <span className="pin-value">{newPin}</span>
            <button className="btn-copy" onClick={copyPin}>
              {copiedPin ? <Check size={18} /> : <Copy size={18} />}
              {copiedPin ? t("volunteer.copied") : t("volunteer.copy")}
            </button>
          </div>
          <button className="btn-dismiss" onClick={() => setNewPin(null)}>
            {t("volunteer.dismiss")}
          </button>
        </div>
      )}

      <Modal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title={t("volunteer.registerNew")}
        hideFooter
      >
        <form className="volunteer-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="name">{t("volunteer.fullName")} *</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              required
              placeholder={t("volunteer.fullName")}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="phone">
                <Phone size={14} /> {t("volunteer.phone")}
              </label>
              <input
                type="tel"
                id="phone"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                placeholder="+1 234 567 8900"
              />
            </div>

            <div className="form-group">
              <label htmlFor="email">
                <Mail size={14} /> {t("volunteer.email")}
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="volunteer@email.com"
              />
            </div>
          </div>

          <div className="form-group">
            <label>{t("volunteer.skills")}</label>
            <div className="skills-grid">
              {SKILL_OPTIONS.map((skill) => (
                <button
                  key={skill}
                  type="button"
                  className={`skill-chip ${
                    formData.skills.includes(skill) ? "selected" : ""
                  }`}
                  onClick={() => handleSkillToggle(skill)}
                >
                  {skill}
                </button>
              ))}
            </div>
          </div>

          <div className="form-actions">
            <button type="button" className="btn-cancel" onClick={() => setShowForm(false)}>
              {t("common.cancel")}
            </button>
            <button type="submit" className="btn-submit" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 size={18} className="spin" />{" "}
                  {t("volunteer.registering")}
                </>
              ) : (
                <>
                  <UserPlus size={18} /> {t("volunteer.register")}
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>

      <div className="volunteers-list">
        <h3>
          {t("volunteer.activeVolunteers")} (
          {volunteers.filter((v) => v.isActive).length})
        </h3>

        {loading ? (
          <div className="loading-state">
            <Loader2 size={24} className="spin" />
            {t("common.loading")}
          </div>
        ) : volunteers.length === 0 ? (
          <div className="empty-state">
            <Users size={48} />
            <p>{t("volunteer.noVolunteers")}</p>
          </div>
        ) : (
          <div className="volunteers-grid">
            {volunteers
              .filter((v) => v.isActive)
              .map((volunteer) => (
                <div key={volunteer._id} className="volunteer-card">
                  <div className="volunteer-header">
                    <h4>{volunteer.name}</h4>
                    <span className="volunteer-pin">
                      {t("volunteer.pin")}: {volunteer.pin}
                    </span>
                  </div>

                  <div className="volunteer-details">
                    {volunteer.phone && (
                      <p>
                        <Phone size={14} /> {volunteer.phone}
                      </p>
                    )}
                    {volunteer.email && (
                      <p>
                        <Mail size={14} /> {volunteer.email}
                      </p>
                    )}
                  </div>

                  {volunteer.skills?.length > 0 && (
                    <div className="volunteer-skills">
                      {volunteer.skills.map((skill) => (
                        <span key={skill} className="skill-tag">
                          {skill}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="volunteer-actions">
                    <span className="joined-date">
                      {t("volunteer.joined")}:{" "}
                      {new Date(volunteer.createdAt).toLocaleDateString()}
                    </span>
                    <div className="action-buttons">
                      <button
                        className="btn-message"
                        onClick={() => handleOpenMessage(volunteer)}
                        title={t("messaging.send")}
                      >
                        <MessageSquare size={14} />
                      </button>
                      <button
                        className="btn-deactivate"
                        onClick={() =>
                          handleDeactivate(volunteer._id, volunteer.name)
                        }
                        title={t("common.delete")}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Message Modal */}
      {messageModal.open && messageModal.volunteer && (
        <div className="message-modal-overlay" onClick={handleCloseMessage}>
          <div className="message-modal" onClick={(e) => e.stopPropagation()}>
            <div className="message-modal-header">
              <div className="modal-recipient">
                <div className="recipient-avatar">
                  {messageModal.volunteer.name.charAt(0).toUpperCase()}
                </div>
                <div className="recipient-info">
                  <h4>
                    {t("messaging.send")} {messageModal.volunteer.name}
                  </h4>
                  <span>
                    {messageModal.volunteer.phone ||
                      messageModal.volunteer.email ||
                      t("family.noPhone")}
                  </span>
                </div>
              </div>
              <button className="btn-close-modal" onClick={handleCloseMessage}>
                <X size={20} />
              </button>
            </div>

            <div className="message-modal-body">
              <textarea
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder={t("messaging.typeMessage")}
                rows={5}
                autoFocus
              />
            </div>

            <div className="message-modal-footer">
              <button className="btn-cancel-msg" onClick={handleCloseMessage}>
                {t("common.cancel")}
              </button>
              <button
                className="btn-send-msg"
                onClick={handleSendMessage}
                disabled={!messageText.trim() || sendingMessage}
              >
                {sendingMessage ? (
                  <>
                    <Loader2 size={16} className="spin" /> {t("messaging.send")}
                    ...
                  </>
                ) : (
                  <>
                    <Send size={16} /> {t("messaging.send")}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

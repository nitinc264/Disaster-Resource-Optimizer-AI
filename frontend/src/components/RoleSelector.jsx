import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ShieldCheck,
  Users,
  User,
  ArrowRight,
  MapPin,
  MapPinOff,
  Loader2,
} from "lucide-react";
import "./RoleSelector.css";

export default function RoleSelector({ onSelectRole, onPublicAccess }) {
  const { t } = useTranslation();
  const [locationStatus, setLocationStatus] = useState("idle");
  const [pendingRole, setPendingRole] = useState(null);

  const checkLocationAndProceed = async (role, callback) => {
    if (!navigator.geolocation) {
      callback(role);
      return;
    }

    setPendingRole(role);
    setLocationStatus("checking");

    const timeoutId = setTimeout(() => {
      setLocationStatus("granted");
      callback(role);
    }, 8000);

    navigator.geolocation.getCurrentPosition(
      () => {
        clearTimeout(timeoutId);
        setLocationStatus("granted");
        callback(role);
      },
      (error) => {
        clearTimeout(timeoutId);
        if (error.code === 1) {
          setLocationStatus("denied");
          setPendingRole(null);
        } else {
          setLocationStatus("granted");
          callback(role);
        }
      },
      { enableHighAccuracy: false, timeout: 5000, maximumAge: Infinity },
    );
  };

  const handleRoleSelect = (role) => {
    if (role === "public") {
      checkLocationAndProceed(role, () => onPublicAccess());
    } else {
      checkLocationAndProceed(role, onSelectRole);
    }
  };

  const retryLocation = () => {
    if (pendingRole) handleRoleSelect(pendingRole);
  };

  /* ---- Location denied ---- */
  if (locationStatus === "denied") {
    return (
      <div className="rs-page">
        <div className="rs-card">
          <Logo />
          <div className="rs-center-block">
            <div className="rs-loc-icon rs-loc-icon--error">
              <MapPinOff size={28} />
            </div>
            <h2 className="rs-heading">
              {t("roleSelector.locationRequired", "Location Access Required")}
            </h2>
            <p className="rs-muted">
              {t(
                "roleSelector.locationHint",
                "Enable location access to use the emergency response system. Your location is needed to coordinate rescue operations.",
              )}
            </p>
            <button className="rs-btn rs-btn--primary" onClick={retryLocation}>
              <MapPin size={16} />
              {t("roleSelector.enableLocation", "Enable Location")}
            </button>
            <button
              className="rs-btn rs-btn--ghost"
              onClick={() => {
                setLocationStatus("idle");
                setPendingRole(null);
              }}
            >
              {t("common.back", "Back")}
            </button>
          </div>
        </div>
        <Footer t={t} />
      </div>
    );
  }

  /* ---- Location checking ---- */
  if (locationStatus === "checking") {
    return (
      <div className="rs-page">
        <div className="rs-card">
          <Logo />
          <div className="rs-center-block">
            <Loader2 size={32} className="rs-spin" />
            <p className="rs-muted" style={{ marginTop: 12 }}>
              {t(
                "roleSelector.checkingLocation",
                "Checking location access...",
              )}
            </p>
          </div>
        </div>
        <Footer t={t} />
      </div>
    );
  }

  /* ---- Main role selection ---- */
  return (
    <div className="rs-page">
      <div className="rs-card">
        <Logo />

        <p className="rs-prompt">
          {t("roleSelector.prompt", "How would you like to continue?")}
        </p>

        <div className="rs-roles">
          <RoleButton
            icon={<User size={22} />}
            color="green"
            title={t("roleSelector.publicUser", "Public User")}
            desc={t(
              "roleSelector.publicDesc",
              "Report emergencies, missing persons, and share photos",
            )}
            onClick={() => handleRoleSelect("public")}
          />
          <RoleButton
            icon={<ShieldCheck size={22} />}
            color="orange"
            title={t("roleSelector.manager", "Manager")}
            desc={t(
              "roleSelector.managerDesc",
              "Full access to dashboard and coordination",
            )}
            onClick={() => handleRoleSelect("manager")}
          />
          <RoleButton
            icon={<Users size={22} />}
            color="blue"
            title={t("roleSelector.volunteer", "Volunteer")}
            desc={t("roleSelector.volunteerDesc", "Access tasks and missions")}
            onClick={() => handleRoleSelect("volunteer")}
          />
        </div>
      </div>
      <Footer t={t} />
    </div>
  );
}

/* ---- Sub-components ---- */

function Logo() {
  return (
    <div className="rs-logo">
      <div className="rs-logo-icon">
        <ShieldCheck size={26} strokeWidth={2.5} />
      </div>
      <span className="rs-logo-text">AEGIS</span>
    </div>
  );
}

function Footer({ t }) {
  return (
    <p className="rs-footer">
      {t(
        "roleSelector.branding",
        "Disaster Response Resource Optimization Platform",
      )}
    </p>
  );
}

function RoleButton({ icon, color, title, desc, onClick }) {
  return (
    <button className={`rs-role rs-role--${color}`} onClick={onClick}>
      <span className="rs-role-icon">{icon}</span>
      <span className="rs-role-body">
        <span className="rs-role-title">{title}</span>
        <span className="rs-role-desc">{desc}</span>
      </span>
      <ArrowRight size={18} className="rs-role-arrow" />
    </button>
  );
}

import { useState, useRef, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useTranslation } from "react-i18next";
import {
  ShieldCheck,
  AlertCircle,
  Loader2,
  Lock,
  MapPin,
  ChevronLeft,
} from "lucide-react";
import "./PinLogin.css";

export default function PinLogin({ onBack, selectedRole }) {
  const { login } = useAuth();
  const { t } = useTranslation();
  const [pin, setPin] = useState(["", "", "", ""]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRefs = [useRef(), useRef(), useRef(), useRef()];

  // Focus first input on mount (location already checked in RoleSelector)
  useEffect(() => {
    inputRefs[0].current?.focus();
  }, []);

  const handleChange = (index, value) => {
    // Only allow digits
    if (value && !/^\d$/.test(value)) return;

    const newPin = [...pin];
    newPin[index] = value;
    setPin(newPin);
    setError("");

    // Auto-focus next input
    if (value && index < 3) {
      inputRefs[index + 1].current?.focus();
    }

    // Auto-submit when all 4 digits entered
    if (value && index === 3) {
      const fullPin = newPin.join("");
      if (fullPin.length === 4) {
        handleSubmit(fullPin);
      }
    }
  };

  const handleKeyDown = (index, e) => {
    // Handle backspace
    if (e.key === "Backspace" && !pin[index] && index > 0) {
      inputRefs[index - 1].current?.focus();
    }
    // Handle arrow keys
    if (e.key === "ArrowLeft" && index > 0) {
      inputRefs[index - 1].current?.focus();
    }
    if (e.key === "ArrowRight" && index < 3) {
      inputRefs[index + 1].current?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").slice(0, 4);
    if (/^\d{1,4}$/.test(pastedData)) {
      const newPin = [...pin];
      pastedData.split("").forEach((digit, i) => {
        if (i < 4) newPin[i] = digit;
      });
      setPin(newPin);

      // Focus appropriate input and maybe submit
      const lastIndex = Math.min(pastedData.length - 1, 3);
      inputRefs[lastIndex].current?.focus();

      if (pastedData.length === 4) {
        handleSubmit(pastedData);
      }
    }
  };

  const handleSubmit = async (pinValue) => {
    const fullPin = pinValue || pin.join("");

    if (fullPin.length !== 4) {
      setError(t("auth.enterAllDigits"));
      return;
    }

    setLoading(true);
    setError("");

    try {
      const result = await login(fullPin);
      if (!result.success) {
        setError(result.message || t("auth.invalidPin"));
        setPin(["", "", "", ""]);
        inputRefs[0].current?.focus();
      }
    } catch (err) {
      setError(t("auth.loginFailed"));
      setPin(["", "", "", ""]);
      inputRefs[0].current?.focus();
    } finally {
      setLoading(false);
    }
  };

  // Get role display text
  const roleText =
    selectedRole === "manager"
      ? t("roleSelector.manager")
      : t("roleSelector.volunteer");

  return (
    <div className="pin-login-container">
      <div className="pin-login-card">
        {/* Back Button */}
        {onBack && (
          <button className="pin-back-btn" onClick={onBack}>
            <ChevronLeft size={20} />
            <span>{t("common.back")}</span>
          </button>
        )}

        <div className="pin-login-header">
          <div className="pin-login-logo">
            <div className="logo-icon">
              <ShieldCheck size={32} strokeWidth={2.5} />
            </div>
            <span className="logo-text">AEGIS</span>
          </div>
          <h1>{t("auth.portalTitle")}</h1>
          <p className="login-subtitle">
            {selectedRole
              ? t("auth.roleLogin", { role: roleText })
              : t("auth.secureAccess")}
          </p>
        </div>

        <div className="location-granted-badge">
          <MapPin size={12} />
          <span>{t("auth.locationActive")}</span>
        </div>

        <div className="pin-section">
          <div className="pin-label">
            <Lock size={14} />
            <span>
              {t("auth.enterPin", {
                role: selectedRole ? roleText : t("common.user"),
              })}
            </span>
          </div>

          <div className="pin-input-group">
            {pin.map((digit, index) => (
              <input
                key={index}
                ref={inputRefs[index]}
                type="password"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                onPaste={index === 0 ? handlePaste : undefined}
                className={`pin-input ${digit ? "filled" : ""} ${
                  error ? "error" : ""
                }`}
                disabled={loading}
                aria-label={t("auth.pinDigit", { index: index + 1 })}
              />
            ))}
          </div>

          {error && (
            <div className="pin-error">
              <AlertCircle size={14} />
              <span>{error}</span>
            </div>
          )}

          {loading && (
            <div className="pin-loading">
              <Loader2 size={18} className="spin" />
              <span>{t("auth.authenticating")}</span>
            </div>
          )}
        </div>

        <div className="pin-login-footer">
          <p>{t("auth.authorizedOnly")}</p>
        </div>
      </div>

      <div className="login-branding">
        <span>{t("auth.platformName")}</span>
      </div>
    </div>
  );
}

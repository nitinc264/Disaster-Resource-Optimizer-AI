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

  useEffect(() => {
    inputRefs[0].current?.focus();
  }, []);

  const handleChange = (index, value) => {
    if (value && !/^\d$/.test(value)) return;

    const newPin = [...pin];
    newPin[index] = value;
    setPin(newPin);
    setError("");

    if (value && index < 3) {
      inputRefs[index + 1].current?.focus();
    }

    if (value && index === 3) {
      const fullPin = newPin.join("");
      if (fullPin.length === 4) handleSubmit(fullPin);
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace" && !pin[index] && index > 0) {
      inputRefs[index - 1].current?.focus();
    }
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
      const lastIndex = Math.min(pastedData.length - 1, 3);
      inputRefs[lastIndex].current?.focus();
      if (pastedData.length === 4) handleSubmit(pastedData);
    }
  };

  const handleSubmit = async (pinValue) => {
    const fullPin = pinValue || pin.join("");
    if (fullPin.length !== 4) {
      setError(t("auth.enterAllDigits"));
      return;
    }

    // Prevent double submission (e.g. paste + onChange both firing)
    if (loading) return;

    setLoading(true);
    setError("");

    try {
      const result = await login(fullPin);
      if (!result.success) {
        setError(result.message || t("auth.invalidPin"));
        setPin(["", "", "", ""]);
        inputRefs[0].current?.focus();
      }
    } catch {
      setError(t("auth.loginFailed"));
      setPin(["", "", "", ""]);
      inputRefs[0].current?.focus();
    } finally {
      setLoading(false);
    }
  };

  const roleText =
    selectedRole === "manager"
      ? t("roleSelector.manager")
      : t("roleSelector.volunteer");

  return (
    <div className="pl-page">
      <div className="pl-card">
        {/* Back */}
        {onBack && (
          <button className="pl-back" onClick={onBack}>
            <ChevronLeft size={18} />
            {t("common.back")}
          </button>
        )}

        {/* Logo */}
        <div className="pl-logo">
          <div className="pl-logo-icon">
            <ShieldCheck size={26} strokeWidth={2.5} />
          </div>
          <span className="pl-logo-text">AEGIS</span>
        </div>

        {/* Title */}
        <h1 className="pl-title">{t("auth.portalTitle")}</h1>
        <p className="pl-subtitle">
          {selectedRole
            ? t("auth.roleLogin", { role: roleText })
            : t("auth.secureAccess")}
        </p>

        {/* Location badge */}
        <div className="pl-location-badge">
          <MapPin size={12} />
          <span>{t("auth.locationActive")}</span>
        </div>

        {/* PIN input */}
        <div className="pl-pin-section">
          <label className="pl-pin-label">
            <Lock size={13} />
            {t("auth.enterPin", {
              role: selectedRole ? roleText : t("common.user"),
            })}
          </label>

          <div className="pl-pin-group">
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
                className={`pl-pin-input ${digit ? "pl-pin-input--filled" : ""} ${error ? "pl-pin-input--error" : ""}`}
                disabled={loading}
                aria-label={t("auth.pinDigit", { index: index + 1 })}
              />
            ))}
          </div>

          {error && (
            <div className="pl-error">
              <AlertCircle size={14} />
              <span>{error}</span>
            </div>
          )}

          {loading && (
            <div className="pl-loading">
              <Loader2 size={18} className="pl-spin" />
              <span>{t("auth.authenticating")}</span>
            </div>
          )}
        </div>

        <p className="pl-footer">{t("auth.authorizedOnly")}</p>
      </div>

      <p className="pl-branding">{t("auth.platformName")}</p>
    </div>
  );
}

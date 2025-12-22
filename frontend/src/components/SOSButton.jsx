import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, MapPin, Phone, Loader2 } from "lucide-react";
import "./SOSButton.css";

/**
 * SOS/Panic Button - One-tap emergency alert with auto-location
 */
export default function SOSButton({
  volunteerId = "volunteer-1",
  volunteerName = "Field Worker",
}) {
  const { t } = useTranslation();
  const [isPressed, setIsPressed] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const [isActivated, setIsActivated] = useState(false);
  const [location, setLocation] = useState(null);
  const [isLocating, setIsLocating] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [alertSent, setAlertSent] = useState(false);

  const HOLD_DURATION = 1500; // 1.5 seconds to activate (faster for emergencies)
  const HOLD_INTERVAL = 50; // Update every 50ms

  // Get current location
  const getCurrentLocation = useCallback(() => {
    setIsLocating(true);

    if (!navigator.geolocation) {
      setIsLocating(false);
      return Promise.resolve(null);
    }

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const loc = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: new Date().toISOString(),
          };
          setLocation(loc);
          setIsLocating(false);
          resolve(loc);
        },
        (error) => {
          console.error("Location error:", error);
          setIsLocating(false);
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  }, []);

  // Handle hold progress
  useEffect(() => {
    let interval;

    if (isPressed && !isActivated) {
      interval = setInterval(() => {
        setHoldProgress((prev) => {
          const newProgress = prev + (HOLD_INTERVAL / HOLD_DURATION) * 100;

          if (newProgress >= 100) {
            setIsActivated(true);
            triggerSOS();
            return 100;
          }
          return newProgress;
        });
      }, HOLD_INTERVAL);
    } else if (!isPressed) {
      setHoldProgress(0);
    }

    return () => clearInterval(interval);
  }, [isPressed, isActivated]);

  // Trigger SOS alert
  const triggerSOS = async () => {
    // Vibrate if supported
    if (navigator.vibrate) {
      navigator.vibrate([200, 100, 200, 100, 200]);
    }

    // Get location
    const loc = await getCurrentLocation();

    // Send SOS alert (mock for now)
    const sosData = {
      volunteerId,
      volunteerName,
      type: "SOS",
      priority: "critical",
      location: loc,
      timestamp: new Date().toISOString(),
      message: "Emergency SOS activated by field volunteer",
    };

    console.log("SOS Alert Triggered:", sosData);
    window.dispatchEvent(new CustomEvent("sos-alert", { detail: sosData }));

    // TODO: Send to backend
    // await sendSOSAlert(sosData);

    setAlertSent(true);
    setShowConfirmation(true);
  };

  // Cancel SOS
  const cancelSOS = () => {
    setIsActivated(false);
    setIsPressed(false);
    setHoldProgress(0);
    setShowConfirmation(false);
    setAlertSent(false);

    // TODO: Send cancellation to backend
    console.log("SOS Cancelled");
  };

  // Handle mouse/touch events
  const handlePressStart = () => {
    if (!isActivated) {
      setIsPressed(true);
    }
  };

  const handlePressEnd = () => {
    if (!isActivated) {
      setIsPressed(false);
    }
  };

  return (
    <>
      {/* Main SOS Button */}
      <button
        className={`sos-button ${isPressed ? "pressing" : ""} ${
          isActivated ? "activated" : ""
        }`}
        onMouseDown={handlePressStart}
        onMouseUp={handlePressEnd}
        onMouseLeave={handlePressEnd}
        onTouchStart={handlePressStart}
        onTouchEnd={handlePressEnd}
        aria-label={t("sos.holdToActivate")}
        style={{
          "--hold-progress": `${holdProgress}%`,
        }}
      >
        <AlertTriangle size={28} className="sos-icon" />
        <span className="sos-label">SOS</span>
        {isPressed && !isActivated && <div className="sos-progress-ring" />}
      </button>

      {/* SOS Alert Modal */}
      {showConfirmation && (
        <div className="sos-confirmation">
          <div className="sos-modal">
            <div className="sos-modal-header">
              <div className="sos-modal-icon">
                <AlertTriangle size={28} />
              </div>
              <h2>🚨 {t("sos.confirmTitle")}</h2>
            </div>

            <div className="sos-modal-body">
              <p>
                {t("sos.confirmMessage")}
              </p>

              <div
                className={`sos-status ${location ? "success" : "locating"}`}
              >
                {location ? (
                  <>
                    <MapPin size={18} />
                    <span>
                      {t("sos.locationAttached")}: {location.lat.toFixed(4)},{" "}
                      {location.lng.toFixed(4)}
                    </span>
                  </>
                ) : isLocating ? (
                  <>
                    <Loader2 size={18} className="spin" />
                    <span>{t("common.loading")}...</span>
                  </>
                ) : (
                  <>
                    <MapPin size={18} />
                    <span>{t("sos.locationFailed")}</span>
                  </>
                )}
              </div>

              <div className="sos-actions">
                <a href="tel:112" className="sos-btn sos-btn-confirm">
                  <Phone size={20} />
                  {t("sos.callEmergency")} (112)
                </a>
                <button className="sos-btn sos-btn-cancel" onClick={cancelSOS}>
                  {t("sos.dismiss")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Floating SOS Button - Fixed position at bottom-right
 */
export function FloatingSOSButton(props) {
  return (
    <div className="sos-floating-wrapper">
      <SOSButton {...props} />
    </div>
  );
}

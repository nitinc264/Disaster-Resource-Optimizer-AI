import { useState, useRef, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import {
  ShieldCheck,
  AlertCircle,
  Loader2,
  Lock,
  MapPinOff,
  MapPin,
} from "lucide-react";
import "./PinLogin.css";

export default function PinLogin() {
  const { login } = useAuth();
  const [pin, setPin] = useState(["", "", "", ""]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [locationStatus, setLocationStatus] = useState("checking"); // 'checking', 'granted', 'denied', 'unsupported'
  const inputRefs = [useRef(), useRef(), useRef(), useRef()];

  // Check location permission on mount
  useEffect(() => {
    checkLocationPermission();
  }, []);

  // Focus first input when location is granted
  useEffect(() => {
    if (locationStatus === "granted") {
      inputRefs[0].current?.focus();
    }
  }, [locationStatus]);

  const checkLocationPermission = async () => {
    if (!navigator.geolocation) {
      setLocationStatus("unsupported");
      return;
    }

    setLocationStatus("checking");

    // Set a maximum time to wait - don't block user forever
    const timeoutId = setTimeout(() => {
      console.log("Location check timeout - allowing access");
      setLocationStatus("granted");
    }, 8000); // Max 8 seconds wait

    // Try to get position - this triggers permission prompt on first visit
    navigator.geolocation.getCurrentPosition(
      (position) => {
        clearTimeout(timeoutId);
        console.log(
          "Location obtained:",
          position.coords.latitude,
          position.coords.longitude
        );
        setLocationStatus("granted");
      },
      (error) => {
        clearTimeout(timeoutId);
        console.log("Geolocation error:", error.code, error.message);

        // Only block if permission was explicitly denied
        if (error.code === 1) {
          // PERMISSION_DENIED
          setLocationStatus("denied");
        } else {
          // Timeout (3) or Position Unavailable (2) - allow access
          // User has given permission, just GPS is slow
          setLocationStatus("granted");
        }
      },
      {
        enableHighAccuracy: false,
        timeout: 5000,
        maximumAge: Infinity, // Accept any cached position
      }
    );
  };

  const requestLocationPermission = () => {
    setLocationStatus("checking");
    // On mobile, sometimes we need to reload to re-trigger permission
    navigator.geolocation.getCurrentPosition(
      () => {
        setLocationStatus("granted");
      },
      (error) => {
        if (error.code === 1) {
          // Still denied - user needs to enable in settings
          alert(
            "Please enable location in your browser/device settings and refresh the page."
          );
          setLocationStatus("denied");
        } else {
          setLocationStatus("granted");
        }
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: Infinity }
    );
  };

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
      setError("Please enter all 4 digits");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const result = await login(fullPin);
      if (!result.success) {
        setError(result.message || "Invalid PIN");
        setPin(["", "", "", ""]);
        inputRefs[0].current?.focus();
      }
    } catch (err) {
      setError("Login failed. Please try again.");
      setPin(["", "", "", ""]);
      inputRefs[0].current?.focus();
    } finally {
      setLoading(false);
    }
  };

  // Location check screen
  if (locationStatus !== "granted") {
    return (
      <div className="pin-login-container">
        <div className="pin-login-card">
          <div className="pin-login-header">
            <div className="pin-login-logo">
              <div className="logo-icon">
                <ShieldCheck size={32} strokeWidth={2.5} />
              </div>
              <span className="logo-text">AEGIS</span>
            </div>
            <h1>Emergency Response Portal</h1>
            <p className="login-subtitle">
              Secure access for authorized personnel
            </p>
          </div>

          <div className="location-check-section">
            {locationStatus === "checking" ? (
              <>
                <div className="location-checking">
                  <Loader2 size={32} className="spin" />
                </div>
                <p className="location-message">Checking location access...</p>
              </>
            ) : locationStatus === "unsupported" ? (
              <>
                <div className="location-error-icon">
                  <MapPinOff size={32} />
                </div>
                <p className="location-message">
                  Location services not supported
                </p>
                <p className="location-hint">
                  This device does not support location services required for
                  emergency response.
                </p>
              </>
            ) : (
              <>
                <div className="location-error-icon">
                  <MapPinOff size={32} />
                </div>
                <p className="location-message">Location Access Required</p>
                <p className="location-hint">
                  Enable location access to use the emergency response system.
                  Your location is needed to coordinate rescue operations.
                </p>
                <button
                  className="enable-location-btn"
                  onClick={requestLocationPermission}
                >
                  <MapPin size={16} />
                  <span>Enable Location</span>
                </button>
              </>
            )}
          </div>

          <div className="pin-login-footer">
            <p>Location is required for emergency coordination.</p>
          </div>
        </div>

        <div className="login-branding">
          <span>Disaster Response Resource Optimization Platform</span>
        </div>
      </div>
    );
  }

  return (
    <div className="pin-login-container">
      <div className="pin-login-card">
        <div className="pin-login-header">
          <div className="pin-login-logo">
            <div className="logo-icon">
              <ShieldCheck size={32} strokeWidth={2.5} />
            </div>
            <span className="logo-text">AEGIS</span>
          </div>
          <h1>Emergency Response Portal</h1>
          <p className="login-subtitle">
            Secure access for authorized personnel
          </p>
        </div>

        <div className="location-granted-badge">
          <MapPin size={12} />
          <span>Location Active</span>
        </div>

        <div className="pin-section">
          <div className="pin-label">
            <Lock size={14} />
            <span>Enter Access PIN</span>
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
                aria-label={`PIN digit ${index + 1}`}
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
              <span>Authenticating...</span>
            </div>
          )}
        </div>

        <div className="pin-login-footer">
          <p>Authorized access only. All activities are monitored.</p>
        </div>
      </div>

      <div className="login-branding">
        <span>Disaster Response Resource Optimization Platform</span>
      </div>
    </div>
  );
}

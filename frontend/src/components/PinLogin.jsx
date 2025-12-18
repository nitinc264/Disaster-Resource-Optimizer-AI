import { useState, useRef, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Shield, AlertCircle, Loader2 } from "lucide-react";
import "./PinLogin.css";

export default function PinLogin() {
  const { login } = useAuth();
  const [pin, setPin] = useState(["", "", "", ""]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRefs = [useRef(), useRef(), useRef(), useRef()];

  // Focus first input on mount
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

  return (
    <div className="pin-login-container">
      <div className="pin-login-card">
        <div className="pin-login-header">
          <div className="pin-login-icon">
            <Shield size={40} />
          </div>
          <h1>Disaster Response</h1>
          <p>Enter your 4-digit PIN to continue</p>
        </div>

        <div className="pin-input-group">
          {pin.map((digit, index) => (
            <input
              key={index}
              ref={inputRefs[index]}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              onPaste={index === 0 ? handlePaste : undefined}
              className={`pin-input ${error ? "error" : ""}`}
              disabled={loading}
              aria-label={`PIN digit ${index + 1}`}
            />
          ))}
        </div>

        {error && (
          <div className="pin-error">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {loading && (
          <div className="pin-loading">
            <Loader2 size={20} className="spin" />
            <span>Verifying...</span>
          </div>
        )}

        <div className="pin-login-footer">
          <p>Quick access for emergency responders</p>
          <p className="pin-hint">Default manager PIN: 0000</p>
        </div>
      </div>
    </div>
  );
}

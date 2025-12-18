import { useState, useEffect, createContext, useContext } from "react";
import { useTranslation } from "react-i18next";
import { Eye, Type, Zap, Monitor, Settings, X, Check } from "lucide-react";
import "./AccessibilitySettings.css";

// Accessibility Context
const AccessibilityContext = createContext(null);

// Custom hook to use accessibility settings
export function useAccessibility() {
  const context = useContext(AccessibilityContext);
  if (!context) {
    throw new Error(
      "useAccessibility must be used within AccessibilityProvider"
    );
  }
  return context;
}

// Accessibility Provider component
export function AccessibilityProvider({ children }) {
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem("accessibilitySettings");
    return saved
      ? JSON.parse(saved)
      : {
          highContrast: false,
          largeText: false,
          reduceMotion: false,
          screenReaderMode: false,
        };
  });

  // Apply settings to document
  useEffect(() => {
    const root = document.documentElement;

    // High contrast
    root.classList.toggle("high-contrast", settings.highContrast);

    // Large text
    root.classList.toggle("large-text", settings.largeText);

    // Reduce motion
    root.classList.toggle("reduce-motion", settings.reduceMotion);

    // Screen reader mode
    root.classList.toggle("screen-reader-mode", settings.screenReaderMode);

    // Persist settings
    localStorage.setItem("accessibilitySettings", JSON.stringify(settings));
  }, [settings]);

  // Listen for system preference changes
  useEffect(() => {
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const contrastQuery = window.matchMedia("(prefers-contrast: high)");

    const handleMotionChange = (e) => {
      if (e.matches && !settings.reduceMotion) {
        setSettings((prev) => ({ ...prev, reduceMotion: true }));
      }
    };

    const handleContrastChange = (e) => {
      if (e.matches && !settings.highContrast) {
        setSettings((prev) => ({ ...prev, highContrast: true }));
      }
    };

    motionQuery.addEventListener("change", handleMotionChange);
    contrastQuery.addEventListener("change", handleContrastChange);

    return () => {
      motionQuery.removeEventListener("change", handleMotionChange);
      contrastQuery.removeEventListener("change", handleContrastChange);
    };
  }, [settings.reduceMotion, settings.highContrast]);

  const toggleSetting = (key) => {
    setSettings((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const resetSettings = () => {
    setSettings({
      highContrast: false,
      largeText: false,
      reduceMotion: false,
      screenReaderMode: false,
    });
  };

  return (
    <AccessibilityContext.Provider
      value={{ settings, toggleSetting, resetSettings }}
    >
      {children}
    </AccessibilityContext.Provider>
  );
}

// Accessibility Settings Panel
export default function AccessibilitySettings({ isOpen, onClose }) {
  const { t } = useTranslation();
  const { settings, toggleSetting, resetSettings } = useAccessibility();

  if (!isOpen) return null;

  const accessibilityOptions = [
    {
      key: "highContrast",
      icon: Eye,
      label: t("accessibility.highContrast"),
      description: "Increase contrast for better visibility",
    },
    {
      key: "largeText",
      icon: Type,
      label: t("accessibility.largeText"),
      description: "Increase text size throughout the app",
    },
    {
      key: "reduceMotion",
      icon: Zap,
      label: t("accessibility.reduceMotion"),
      description: "Minimize animations and transitions",
    },
    {
      key: "screenReaderMode",
      icon: Monitor,
      label: t("accessibility.screenReaderMode"),
      description: "Optimize for screen readers",
    },
  ];

  return (
    <div
      className="accessibility-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Accessibility Settings"
    >
      <div className="accessibility-panel" onClick={(e) => e.stopPropagation()}>
        <div className="accessibility-header">
          <div className="accessibility-title">
            <Settings size={20} aria-hidden="true" />
            <h2>Accessibility Settings</h2>
          </div>
          <button
            className="accessibility-close"
            onClick={onClose}
            aria-label="Close accessibility settings"
          >
            <X size={20} />
          </button>
        </div>

        <div className="accessibility-options">
          {accessibilityOptions.map((option) => (
            <button
              key={option.key}
              className={`accessibility-option ${
                settings[option.key] ? "active" : ""
              }`}
              onClick={() => toggleSetting(option.key)}
              aria-pressed={settings[option.key]}
            >
              <div className="option-icon">
                <option.icon size={24} aria-hidden="true" />
              </div>
              <div className="option-content">
                <span className="option-label">{option.label}</span>
                <span className="option-description">{option.description}</span>
              </div>
              <div className="option-toggle">
                {settings[option.key] ? (
                  <Check size={18} className="toggle-check" />
                ) : (
                  <div className="toggle-circle" />
                )}
              </div>
            </button>
          ))}
        </div>

        <div className="accessibility-footer">
          <button
            className="reset-button"
            onClick={resetSettings}
            aria-label="Reset all accessibility settings to default"
          >
            Reset to Default
          </button>
        </div>
      </div>
    </div>
  );
}

// Accessibility Toggle Button (for header/nav)
export function AccessibilityToggle({ onClick }) {
  return (
    <button
      className="accessibility-toggle"
      onClick={onClick}
      aria-label="Open accessibility settings"
      title="Accessibility Settings"
    >
      <Settings size={20} aria-hidden="true" />
    </button>
  );
}

// Skip to main content link (for keyboard navigation)
export function SkipToContent() {
  return (
    <a href="#main-content" className="skip-to-content">
      Skip to main content
    </a>
  );
}

import { useState, useEffect, createContext, useContext } from "react";
import { useTranslation } from "react-i18next";
import { Sun, Moon, Globe, Settings, X, RotateCcw } from "lucide-react";
import { languages } from "../i18n";
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
          darkMode: true,
        };
  });

  // Apply settings to document
  useEffect(() => {
    const root = document.documentElement;

    // Dark/Light mode
    if (settings.darkMode) {
      root.classList.add("dark-mode");
      root.classList.remove("light-mode");
    } else {
      root.classList.add("light-mode");
      root.classList.remove("dark-mode");
    }

    // Persist settings
    localStorage.setItem("accessibilitySettings", JSON.stringify(settings));
  }, [settings]);

  const toggleSetting = (key) => {
    setSettings((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const resetSettings = () => {
    setSettings({
      darkMode: true,
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
  const { t, i18n } = useTranslation();
  const { settings, toggleSetting, resetSettings } = useAccessibility();

  if (!isOpen) return null;

  const handleLanguageChange = (langCode) => {
    i18n.changeLanguage(langCode);
  };

  const currentLang =
    languages.find((l) => l.code === i18n.language) || languages[0];

  return (
    <div
      className="settings-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
    >
      <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h2>
            <Settings size={18} /> {t("settings.title")}
          </h2>
          <button
            className="settings-close"
            onClick={onClose}
            aria-label={t("common.close")}
          >
            <X size={20} />
          </button>
        </div>

        <div className="settings-content">
          {/* Language Section - Mobile Only */}
          <div className="settings-section language-section">
            <label className="settings-label">
              <Globe size={16} />
              {t("settings.language")}
            </label>
            <div className="language-options">
              {languages.map((lang) => (
                <button
                  key={lang.code}
                  className={`lang-btn ${
                    i18n.language === lang.code ? "active" : ""
                  }`}
                  onClick={() => handleLanguageChange(lang.code)}
                >
                  {lang.nativeName}
                </button>
              ))}
            </div>
          </div>

          {/* Display Settings */}
          <div className="settings-section">
            <label className="settings-label">{t("settings.display")}</label>

            <div className="setting-item">
              <div className="setting-info">
                {settings.darkMode ? <Moon size={18} /> : <Sun size={18} />}
                <span>{settings.darkMode ? t("settings.darkMode") : t("settings.lightMode")}</span>
              </div>
              <button
                className={`toggle ${settings.darkMode ? "on" : ""}`}
                onClick={() => toggleSetting("darkMode")}
                aria-pressed={settings.darkMode}
                role="switch"
              >
                <span className="toggle-thumb" />
              </button>
            </div>
          </div>

          {/* Reset */}
          <button className="reset-btn" onClick={resetSettings}>
            <RotateCcw size={14} />
            {t("settings.reset")}
          </button>
        </div>
      </div>
    </div>
  );
}

// Accessibility Toggle Button (for header/nav)
export function AccessibilityToggle({ onClick }) {
  const { t } = useTranslation();
  return (
    <button
      className="accessibility-toggle"
      onClick={onClick}
      aria-label={t("settings.title")}
      title={t("settings.title")}
    >
      <Settings size={20} aria-hidden="true" />
    </button>
  );
}

// Skip to main content link (for keyboard navigation)
export function SkipToContent() {
  const { t } = useTranslation();
  return (
    <a href="#main-content" className="skip-to-content">
      {t("common.skipToContent")}
    </a>
  );
}

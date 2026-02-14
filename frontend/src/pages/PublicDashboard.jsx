import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  Mic,
  Camera,
  Users,
  Shield,
  LogOut,
  Globe,
  ChevronLeft,
  Settings,
  MapIcon,
} from "lucide-react";
import {
  AudioReporter,
  PhotoReporter,
  MissingPersons,
  AccessibilitySettings,
  Map as MapComponent,
} from "../components";
import { getPublicShelters } from "../services/apiService";
import { languages } from "../i18n";
import "./PublicDashboard.css";

function LanguageSwitcher() {
  const { i18n } = useTranslation();

  return (
    <div className="lang-dropdown">
      <Globe size={16} />
      <select
        className="lang-select"
        value={i18n.language}
        onChange={(e) => i18n.changeLanguage(e.target.value)}
        aria-label="Select language"
      >
        {languages.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.nativeName}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function PublicDashboard({ onExit }) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState("shelterMap"); // 'shelterMap' | 'voice' | 'photo' | 'missing'
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [publicShelters, setPublicShelters] = useState([]);

  // Fetch shelters for public map
  useEffect(() => {
    const fetchShelters = async () => {
      try {
        const data = await getPublicShelters();
        setPublicShelters(data);
      } catch (err) {
        console.error("Failed to fetch public shelters:", err);
      }
    };
    fetchShelters();
    const interval = setInterval(fetchShelters, 30000);
    return () => clearInterval(interval);
  }, []);

  const tabs = [
    {
      id: "shelterMap",
      label: t("publicDashboard.shelterMap", "Shelter Map"),
      icon: Shield,
    },
    {
      id: "voice",
      label: t("publicDashboard.voiceReport", "Voice Report"),
      icon: Mic,
    },
    {
      id: "photo",
      label: t("publicDashboard.photoReport", "Photo Report"),
      icon: Camera,
    },
    {
      id: "missing",
      label: t("publicDashboard.missingPerson", "Missing Person"),
      icon: Users,
    },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case "shelterMap":
        return (
          <div className="public-shelter-map">
            <MapComponent
              needs={[]}
              selectedNeedIds={new Set()}
              onPinClick={() => {}}
              shelters={publicShelters}
            />
          </div>
        );
      case "voice":
        return <AudioReporter />;
      case "photo":
        return <PhotoReporter />;
      case "missing":
        return <MissingPersons isPublicMode={true} />;
      default:
        return <AudioReporter />;
    }
  };

  return (
    <div className="public-dashboard">
      {/* Header */}
      <header className="public-header">
        <div className="public-header-inner">
          {/* Back Button */}
          <button
            className="back-button"
            onClick={onExit}
            title={t("common.back", "Back")}
          >
            <ChevronLeft size={20} />
          </button>

          {/* Brand */}
          <div className="public-brand">
            <Shield size={20} className="brand-icon" />
            <span className="brand-name">AEGIS</span>
          </div>

          {/* Public Badge */}
          <div className="public-badge">
            {t("publicDashboard.publicUser", "Public User")}
          </div>

          {/* Right Controls */}
          <div className="public-header-actions">
            <LanguageSwitcher />
            <button
              className="icon-btn"
              onClick={() => setSettingsOpen(true)}
              title={t("settings.title", "Settings")}
            >
              <Settings size={18} />
            </button>
            <button
              className="exit-btn"
              onClick={onExit}
              title={t("common.exit", "Exit")}
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <nav className="public-tabs">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              className={`public-tab ${activeTab === tab.id ? "active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon size={18} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Main Content */}
      <main className="public-main">
        <div className="public-content">{renderContent()}</div>
      </main>

      {/* Accessibility Settings Modal */}
      <AccessibilitySettings
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
}

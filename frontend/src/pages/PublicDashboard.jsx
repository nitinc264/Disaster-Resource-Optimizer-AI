import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  Mic,
  Camera,
  Users,
  MapPin,
  LogOut,
  Globe,
  ShieldCheck,
  Settings,
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

export default function PublicDashboard({ onExit }) {
  const { t, i18n } = useTranslation();
  const [activeTab, setActiveTab] = useState("shelterMap");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [publicShelters, setPublicShelters] = useState([]);

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
      icon: MapPin,
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
          <div className="pd-map-wrap">
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
    <div className="pd-page">
      {/* Header */}
      <header className="pd-header">
        <div className="pd-header-left">
          <ShieldCheck size={20} className="pd-brand-icon" />
          <span className="pd-brand">AEGIS</span>
          <span className="pd-badge">
            {t("publicDashboard.publicUser", "Public")}
          </span>
        </div>

        <div className="pd-header-right">
          <div className="pd-lang">
            <Globe size={14} />
            <select
              className="pd-lang-select"
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

          <button
            className="pd-icon-btn"
            onClick={() => setSettingsOpen(true)}
            title={t("settings.title", "Settings")}
          >
            <Settings size={17} />
          </button>

          <button
            className="pd-exit-btn"
            onClick={onExit}
            title={t("common.exit", "Exit")}
          >
            <LogOut size={16} />
            <span className="pd-exit-text">{t("common.exit", "Exit")}</span>
          </button>
        </div>
      </header>

      {/* Tabs */}
      <nav className="pd-tabs">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              className={`pd-tab ${activeTab === tab.id ? "pd-tab--active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon size={17} className="pd-tab-icon" />
              <span className="pd-tab-text">{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Content */}
      <main className="pd-main">
        <div className="pd-content">{renderContent()}</div>
      </main>

      {/* Accessibility Modal */}
      <AccessibilitySettings
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
}

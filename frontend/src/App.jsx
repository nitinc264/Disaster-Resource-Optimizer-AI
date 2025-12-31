import { useState, useEffect } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  NavLink,
  Navigate,
} from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { languages } from "./i18n";
import {
  AccessibilityProvider,
  AccessibilitySettings,
  PinLogin,
  EmergencyStations,
} from "./components";
import { AuthProvider, useAuth, VolunteerRouteProvider } from "./contexts";
import { VolunteerPage, DashboardPage, ResourcesPage, AddShelterPage } from "./pages";
import { LogOut, Globe, Settings, Shield, AlertTriangle } from "lucide-react";
import { initSyncListeners } from "./services/syncService";
import "./App.css";

// Create a react-query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

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

function AuthenticatedApp() {
  const { t } = useTranslation();
  const { logout, isManager } = useAuth();
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <BrowserRouter>
      <div className="app-shell">
        {/* Clean Simple Navbar */}
        <header className="navbar">
          <div className="navbar-inner">
            {/* Brand */}
            <div className="navbar-brand">
              <Shield size={24} className="brand-icon" />
              <span className="brand-name">AEGIS</span>
            </div>

            {/* Role Badge */}
            <div
              className={`role-badge ${isManager ? "manager" : "volunteer"}`}
            >
              {isManager ? t("common.manager") : t("common.volunteer")}
            </div>

            {/* Navigation Tabs */}
            <nav className="navbar-tabs">
              <NavLink
                to="/dashboard"
                className={({ isActive }) =>
                  `nav-tab ${isActive ? "active" : ""}`
                }
              >
                {t("nav.dashboard")}
              </NavLink>
              <NavLink
                to="/tasks"
                className={({ isActive }) =>
                  `nav-tab ${isActive ? "active" : ""}`
                }
              >
                {t("nav.tasks")}
              </NavLink>
              {/* Resources tab hidden per request */}
              {isManager && (
                <NavLink
                  to="/emergency-stations"
                  className={({ isActive }) =>
                    `nav-tab ${isActive ? "active" : ""}`
                  }
                >
                  <AlertTriangle size={14} style={{ marginRight: "4px" }} />
                  Stations
                </NavLink>
              )}
            </nav>

            {/* Right Controls */}
            <div className="navbar-actions">
              <LanguageSwitcher />

              <button
                className="icon-btn"
                onClick={() => setSettingsOpen(true)}
                title={t("settings.title")}
              >
                <Settings size={18} />
              </button>

              <button
                className="logout-btn"
                onClick={logout}
                title={t("common.logout")}
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </header>

        <main id="main-content" className="app-main" role="main">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/tasks" element={<VolunteerPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/resources" element={<ResourcesPage />} />
            <Route path="/add-shelter" element={<AddShelterPage />} />
            <Route path="/emergency-stations" element={<EmergencyStations />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
      </div>

      <AccessibilitySettings
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </BrowserRouter>
  );
}

function App() {
  const { isAuthenticated, loading } = useAuth();
  const { t } = useTranslation();

  // Initialize sync listeners when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      const cleanup = initSyncListeners();
      return cleanup;
    }
  }, [isAuthenticated]);

  if (loading) {
    return (
      <div className="app-loading">
        <div className="loading-spinner" />
        <p>{t("common.loading")}</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <PinLogin />;
  }

  return <AuthenticatedApp />;
}

function AppWrapper() {
  return (
    <AccessibilityProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <VolunteerRouteProvider>
            <App />
          </VolunteerRouteProvider>
        </AuthProvider>
      </QueryClientProvider>
    </AccessibilityProvider>
  );
}

export default AppWrapper;

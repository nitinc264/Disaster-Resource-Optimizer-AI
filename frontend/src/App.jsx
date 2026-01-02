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
  RoleSelector,
} from "./components";
import MessagingModal from "./components/MessagingModal";
import { AuthProvider, useAuth, VolunteerRouteProvider } from "./contexts";
import { VolunteerPage, DashboardPage, ResourcesPage, AddShelterPage, PublicDashboard } from "./pages";
import { LogOut, Globe, Settings, Shield, AlertTriangle, MessageSquare } from "lucide-react";
import { initSyncListeners } from "./services/syncService";
import { getUnreadCount } from "./services/messagingService";
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
  const [messagingOpen, setMessagingOpen] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);

  // Poll for unread message count
  useEffect(() => {
    const fetchUnread = async () => {
      try {
        const result = await getUnreadCount();
        if (result.success) {
          setUnreadMessages(result.data.unreadCount);
        }
      } catch (err) {
        // Silently fail
      }
    };

    fetchUnread();
    const interval = setInterval(fetchUnread, 10000); // Poll every 10 seconds

    return () => clearInterval(interval);
  }, []);

  // Reset unread count when opening messaging modal
  const handleOpenMessaging = () => {
    setMessagingOpen(true);
  };

  const handleCloseMessaging = () => {
    setMessagingOpen(false);
    // Refresh unread count
    getUnreadCount().then((result) => {
      if (result.success) {
        setUnreadMessages(result.data.unreadCount);
      }
    }).catch(() => {});
  };

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
                className="icon-btn messaging-btn"
                onClick={handleOpenMessaging}
                title={t("messaging.messages") || "Messages"}
              >
                <MessageSquare size={18} />
                {unreadMessages > 0 && (
                  <span className="unread-indicator">{unreadMessages > 9 ? "9+" : unreadMessages}</span>
                )}
              </button>

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

      <MessagingModal
        isOpen={messagingOpen}
        onClose={handleCloseMessaging}
      />
    </BrowserRouter>
  );
}

function App() {
  const { isAuthenticated, loading } = useAuth();
  const { t } = useTranslation();
  const [appMode, setAppMode] = useState(null); // null | 'roleSelect' | 'public' | 'pinLogin'
  const [selectedRole, setSelectedRole] = useState(null); // 'manager' | 'volunteer'

  // Initialize sync listeners when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      const cleanup = initSyncListeners();
      return cleanup;
    }
  }, [isAuthenticated]);

  // Check for stored mode on mount
  useEffect(() => {
    const storedMode = sessionStorage.getItem("aegis_app_mode");
    if (storedMode === "public") {
      setAppMode("public");
    } else if (!isAuthenticated && !loading) {
      setAppMode("roleSelect");
    }
  }, [isAuthenticated, loading]);

  // Handle role selection
  const handleRoleSelect = (role) => {
    setSelectedRole(role);
    setAppMode("pinLogin");
  };

  // Handle public access
  const handlePublicAccess = () => {
    sessionStorage.setItem("aegis_app_mode", "public");
    setAppMode("public");
  };

  // Handle exit from public mode
  const handlePublicExit = () => {
    sessionStorage.removeItem("aegis_app_mode");
    setAppMode("roleSelect");
    setSelectedRole(null);
  };

  // Handle back from PIN login
  const handleBackFromPin = () => {
    setAppMode("roleSelect");
    setSelectedRole(null);
  };

  if (loading) {
    return (
      <div className="app-loading">
        <div className="loading-spinner" />
        <p>{t("common.loading")}</p>
      </div>
    );
  }

  // If authenticated (Manager/Volunteer), show the main app
  if (isAuthenticated) {
    // Clear any public mode if authenticated
    sessionStorage.removeItem("aegis_app_mode");
    return <AuthenticatedApp />;
  }

  // Public mode
  if (appMode === "public") {
    return <PublicDashboard onExit={handlePublicExit} />;
  }

  // PIN Login for Manager/Volunteer
  if (appMode === "pinLogin") {
    return <PinLogin onBack={handleBackFromPin} selectedRole={selectedRole} />;
  }

  // Role selection screen (default for unauthenticated users)
  return (
    <RoleSelector
      onSelectRole={handleRoleSelect}
      onPublicAccess={handlePublicAccess}
    />
  );
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

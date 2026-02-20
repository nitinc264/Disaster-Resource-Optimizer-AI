import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  AccessibilityProvider,
  AccessibilitySettings,
  PinLogin,
  EmergencyStations,
  RoleSelector,
} from "./components";
import Navbar from "./components/Navbar";
import MessagingModal from "./components/MessagingModal";
import { AuthProvider, useAuth, VolunteerRouteProvider, OfflineProvider } from "./contexts";
import {
  VolunteerPage,
  DashboardPage,
  ResourcesPage,
  AddShelterPage,
  PublicDashboard,
} from "./pages";
import { initSyncListeners } from "./services/syncService";
import SyncStatusBar from "./components/SyncStatusBar";
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

function ManagerRoute({ children }) {
  const { isManager } = useAuth();
  return isManager ? children : <Navigate to="/dashboard" replace />;
}

function AuthenticatedApp() {
  const { t } = useTranslation();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [messagingOpen, setMessagingOpen] = useState(false);

  // Reset unread count when opening messaging modal
  const handleOpenMessaging = () => {
    setMessagingOpen(true);
  };

  const handleCloseMessaging = () => {
    setMessagingOpen(false);
  };

  return (
    <BrowserRouter>
      <div className="app-shell">
        <Navbar
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenMessaging={handleOpenMessaging}
        />

        <main id="main-content" className="app-main" role="main">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/tasks" element={<VolunteerPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route
              path="/resources"
              element={
                <ManagerRoute>
                  <ResourcesPage />
                </ManagerRoute>
              }
            />
            <Route
              path="/add-shelter"
              element={
                <ManagerRoute>
                  <AddShelterPage />
                </ManagerRoute>
              }
            />
            <Route
              path="/emergency-stations"
              element={
                <ManagerRoute>
                  <EmergencyStations />
                </ManagerRoute>
              }
            />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
      </div>

      <AccessibilitySettings
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />

      <MessagingModal isOpen={messagingOpen} onClose={handleCloseMessaging} />
      <SyncStatusBar />
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
    return (
      <>
        <PublicDashboard onExit={handlePublicExit} />
        <SyncStatusBar />
      </>
    );
  }

  // PIN Login for Manager/Volunteer
  if (appMode === "pinLogin") {
    return (
      <>
        <PinLogin onBack={handleBackFromPin} selectedRole={selectedRole} />
        <SyncStatusBar />
      </>
    );
  }

  // Role selection screen (default for unauthenticated users)
  return (
    <>
      <RoleSelector
        onSelectRole={handleRoleSelect}
        onPublicAccess={handlePublicAccess}
      />
      <SyncStatusBar />
    </>
  );
}

function AppWrapper() {
  return (
    <AccessibilityProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <OfflineProvider>
            <VolunteerRouteProvider>
              <App />
            </VolunteerRouteProvider>
          </OfflineProvider>
        </AuthProvider>
      </QueryClientProvider>
    </AccessibilityProvider>
  );
}

export default AppWrapper;

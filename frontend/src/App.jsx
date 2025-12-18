import { useState } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  NavLink,
  Link,
  Navigate,
} from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { languages } from "./i18n";
import {
  AccessibilityProvider,
  AccessibilitySettings,
  AccessibilityToggle,
  SkipToContent,
  PinLogin,
} from "./components";
import { AuthProvider, useAuth } from "./contexts";
import { VolunteerPage, DashboardPage } from "./pages";
import { LogOut } from "lucide-react";
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
    <select
      className="language-switcher"
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
  );
}

function UserMenu() {
  const { user, logout, isManager } = useAuth();

  return (
    <div className="user-menu-pill">
      <span className="user-name">{user?.name || "User"}</span>
      <span
        className={`user-role-badge ${isManager ? "manager" : "volunteer"}`}
      >
        {isManager ? "MANAGER" : "VOLUNTEER"}
      </span>
      <button className="logout-icon-btn" onClick={logout} title="Logout">
        <LogOut size={16} />
      </button>
    </div>
  );
}

function AuthenticatedApp() {
  const { t } = useTranslation();
  const [accessibilityOpen, setAccessibilityOpen] = useState(false);

  return (
    <BrowserRouter>
      <SkipToContent />
      <div className="app-shell">
        <header className="app-header">
          <div className="header-content">
            <Link to="/dashboard" className="brand-mark">
              <div className="brand-logo">
                <span className="brand-dot" />
              </div>
              <span className="brand-text">FieldPulse</span>
            </Link>

            <nav className="header-nav">
              <NavLink
                to="/dashboard"
                className={({ isActive }) =>
                  `nav-link ${isActive ? "active" : ""}`
                }
              >
                Command Center
              </NavLink>
              <NavLink
                to="/tasks"
                className={({ isActive }) =>
                  `nav-link ${isActive ? "active" : ""}`
                }
              >
                Field Tasks
              </NavLink>
            </nav>

            <div className="header-controls">
              <LanguageSwitcher />
              <AccessibilityToggle
                onClick={() => setAccessibilityOpen(!accessibilityOpen)}
              />
              <UserMenu />
            </div>
          </div>
        </header>

        <main id="main-content" className="app-main" role="main">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/tasks" element={<VolunteerPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
      </div>

      <AccessibilitySettings
        isOpen={accessibilityOpen}
        onClose={() => setAccessibilityOpen(false)}
      />
    </BrowserRouter>
  );
}

function App() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="app-loading">
        <div className="loading-spinner" />
        <p>Loading...</p>
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
          <App />
        </AuthProvider>
      </QueryClientProvider>
    </AccessibilityProvider>
  );
}

export default AppWrapper;

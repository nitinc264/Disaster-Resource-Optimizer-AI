import {
  BrowserRouter,
  Routes,
  Route,
  NavLink,
  Link,
  Navigate,
} from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SyncStatus } from "./components";
import { VolunteerPage, DashboardPage } from "./pages";
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

function App() {
  const navClass = ({ isActive }) => `nav-link${isActive ? " active" : ""}`;

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <div className="app-shell">
          <header className="app-header">
            <div className="header-content">
              <Link to="/dashboard" className="brand-mark">
                <div className="brand-logo">
                  <span className="brand-dot" />
                </div>
                <span className="brand-text">FieldPulse</span>
              </Link>

              <nav className="nav-links">
                <NavLink to="/tasks" className={navClass}>
                  Tasks
                </NavLink>
                <NavLink to="/dashboard" className={navClass}>
                  Map
                </NavLink>
              </nav>

              <div className="header-actions">
                <SyncStatus />
              </div>
            </div>
          </header>

          <main className="app-main">
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/tasks" element={<VolunteerPage />} />
              <Route path="/dashboard" element={<DashboardPage />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;

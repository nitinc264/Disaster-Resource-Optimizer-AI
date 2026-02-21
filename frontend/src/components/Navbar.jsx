import { useState, useEffect } from "react";
import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { languages } from "../i18n";
import { useAuth } from "../contexts";
import { getUnreadCount } from "../services/messagingService";
import {
  LogOut,
  Globe,
  Settings,
  Shield,
  MessageSquare,
  LayoutDashboard,
  ClipboardList,
  Radio,
} from "lucide-react";
import "./Navbar.css";

function Navbar({ onOpenSettings, onOpenMessaging }) {
  const { t } = useTranslation();
  const { i18n } = useTranslation();
  const { logout, isManager } = useAuth();
  const [unreadMessages, setUnreadMessages] = useState(0);

  useEffect(() => {
    const fetchUnread = async () => {
      try {
        const result = await getUnreadCount();
        if (result.success) {
          setUnreadMessages(result.data.unreadCount);
        }
      } catch {
        // Silently fail
      }
    };

    fetchUnread();
    const interval = setInterval(fetchUnread, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleMessaging = () => {
    onOpenMessaging?.();
  };

  return (
    <header className="Navbar">
      {/* Left: brand */}
      <NavLink to="/dashboard" className="Navbar-brand">
        <Shield size={24} className="Navbar-brandIcon" />
        <span className="Navbar-brandName">AEGIS</span>
        <span
          className={`Navbar-role ${isManager ? "Navbar-role--mgr" : "Navbar-role--vol"}`}
        >
          {isManager ? t("common.manager") : t("common.volunteer")}
        </span>
      </NavLink>

      {/* Center: nav links */}
      <nav className="Navbar-links">
        <NavLink
          to="/dashboard"
          className={({ isActive }) =>
            `Navbar-link ${isActive ? "Navbar-link--active" : ""}`
          }
        >
          <LayoutDashboard size={16} className="Navbar-linkIcon" />
          <span className="Navbar-linkText">{t("nav.dashboard")}</span>
        </NavLink>
        <NavLink
          to="/tasks"
          className={({ isActive }) =>
            `Navbar-link ${isActive ? "Navbar-link--active" : ""}`
          }
        >
          <ClipboardList size={16} className="Navbar-linkIcon" />
          <span className="Navbar-linkText">{t("nav.tasks")}</span>
        </NavLink>
        {isManager && (
          <NavLink
            to="/emergency-stations"
            className={({ isActive }) =>
              `Navbar-link ${isActive ? "Navbar-link--active" : ""}`
            }
          >
            <Radio size={16} className="Navbar-linkIcon" />
            <span className="Navbar-linkText">{t("nav.stations")}</span>
          </NavLink>
        )}
      </nav>

      {/* Right: actions */}
      <div className="Navbar-actions">
        {/* Language Switcher */}
        <div className="Navbar-lang">
          <Globe size={16} className="Navbar-langIcon" />
          <select
            className="Navbar-langSelect"
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
          className="Navbar-iconBtn"
          onClick={handleMessaging}
          title={t("messaging.messages") || "Messages"}
        >
          <MessageSquare size={18} />
          {unreadMessages > 0 && (
            <span className="Navbar-unread">
              {unreadMessages > 9 ? "9+" : unreadMessages}
            </span>
          )}
        </button>

        <button
          className="Navbar-iconBtn"
          onClick={() => onOpenSettings?.()}
          title={t("settings.title")}
        >
          <Settings size={18} />
        </button>

        <button
          className="Navbar-iconBtn Navbar-iconBtn--logout"
          onClick={logout}
          title={t("common.logout")}
        >
          <LogOut size={16} />
        </button>
      </div>
    </header>
  );
}

export default Navbar;

import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  Bell,
  BellOff,
  AlertTriangle,
  X,
  MapPin,
  Clock,
  Volume2,
} from "lucide-react";
import "./AlertNotifications.css";

// Alert types with styling
const ALERT_TYPES = {
  critical: {
    color: "#dc2626",
    bgColor: "#fef2f2",
    borderColor: "#fecaca",
    icon: AlertTriangle,
    sound: true,
  },
  urgent: {
    color: "#ea580c",
    bgColor: "#fff7ed",
    borderColor: "#fed7aa",
    icon: AlertTriangle,
    sound: true,
  },
  warning: {
    color: "#ca8a04",
    bgColor: "#fefce8",
    borderColor: "#fef08a",
    icon: Bell,
    sound: false,
  },
  info: {
    color: "#2563eb",
    bgColor: "#eff6ff",
    borderColor: "#bfdbfe",
    icon: Bell,
    sound: false,
  },
};

/**
 * Alert Notifications System
 */
export default function AlertNotifications({ userId, userArea = null }) {
  const { t } = useTranslation();
  const [alerts, setAlerts] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showPanel, setShowPanel] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Request notification permission
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // Mock: Simulate incoming alerts (replace with WebSocket in production)
  useEffect(() => {
    // Initial mock alerts
    const mockAlerts = [
      {
        id: "alert-1",
        type: "critical",
        title: "Critical Flood Alert",
        message:
          "Water levels rising rapidly in Dharavi area. Immediate evacuation recommended.",
        location: { name: "Dharavi", lat: 19.043, lng: 72.855 },
        timestamp: new Date(Date.now() - 5 * 60000).toISOString(),
        read: false,
      },
      {
        id: "alert-2",
        type: "urgent",
        title: "Medical Emergency",
        message:
          "Multiple casualties reported at Kurla West junction. Medical teams needed.",
        location: { name: "Kurla West", lat: 19.065, lng: 72.879 },
        timestamp: new Date(Date.now() - 15 * 60000).toISOString(),
        read: false,
      },
      {
        id: "alert-3",
        type: "warning",
        title: "Road Closure",
        message:
          "Western Express Highway blocked due to waterlogging. Use alternate routes.",
        location: { name: "Andheri", lat: 19.119, lng: 72.846 },
        timestamp: new Date(Date.now() - 30 * 60000).toISOString(),
        read: true,
      },
    ];

    setAlerts(mockAlerts);
    setUnreadCount(mockAlerts.filter((a) => !a.read).length);

    // Simulate new alert every 2 minutes (for demo)
    const interval = setInterval(() => {
      if (!notificationsEnabled) return;

      const newAlert = {
        id: `alert-${Date.now()}`,
        type:
          Math.random() > 0.7
            ? "critical"
            : Math.random() > 0.5
            ? "urgent"
            : "warning",
        title: "New Incident Report",
        message: "New incident detected in your assigned area. Please review.",
        location: { name: "Mumbai", lat: 19.076, lng: 72.877 },
        timestamp: new Date().toISOString(),
        read: false,
      };

      addAlert(newAlert);
    }, 120000);

    return () => clearInterval(interval);
  }, [notificationsEnabled]);

  // Add new alert
  const addAlert = useCallback(
    (alert) => {
      setAlerts((prev) => [alert, ...prev].slice(0, 50)); // Keep last 50 alerts
      setUnreadCount((prev) => prev + 1);

      // Play sound for critical/urgent
      if (soundEnabled && ALERT_TYPES[alert.type]?.sound) {
        playAlertSound();
      }

      // Show browser notification
      showBrowserNotification(alert);
    },
    [soundEnabled]
  );

  // Play alert sound
  const playAlertSound = () => {
    try {
      const audioContext = new (window.AudioContext ||
        window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 880;
      oscillator.type = "sine";
      gainNode.gain.value = 0.3;

      oscillator.start();
      setTimeout(() => {
        gainNode.gain.exponentialRampToValueAtTime(
          0.001,
          audioContext.currentTime + 0.3
        );
        setTimeout(() => oscillator.stop(), 300);
      }, 100);
    } catch (e) {
      console.log("Audio not supported");
    }
  };

  // Show browser notification
  const showBrowserNotification = (alert) => {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(alert.title, {
        body: alert.message,
        icon: "/favicon.ico",
        tag: alert.id,
        requireInteraction: alert.type === "critical",
      });
    }
  };

  // Mark alert as read
  const markAsRead = (alertId) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === alertId ? { ...a, read: true } : a))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
  };

  // Mark all as read
  const markAllAsRead = () => {
    setAlerts((prev) => prev.map((a) => ({ ...a, read: true })));
    setUnreadCount(0);
  };

  // Dismiss alert
  const dismissAlert = (alertId) => {
    const alert = alerts.find((a) => a.id === alertId);
    if (alert && !alert.read) {
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }
    setAlerts((prev) => prev.filter((a) => a.id !== alertId));
  };

  // Format time
  const formatTime = (timestamp) => {
    const minutes = Math.floor(
      (Date.now() - new Date(timestamp).getTime()) / 60000
    );
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  return (
    <>
      {/* Notification Bell */}
      <button
        className={`alert-bell ${unreadCount > 0 ? "has-alerts" : ""}`}
        onClick={() => setShowPanel(!showPanel)}
        aria-label={`Notifications ${
          unreadCount > 0 ? `(${unreadCount} unread)` : ""
        }`}
      >
        {notificationsEnabled ? <Bell size={20} /> : <BellOff size={20} />}
        {unreadCount > 0 && (
          <span className="alert-badge">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Panel */}
      {showPanel && (
        <div
          className="alert-panel-overlay"
          onClick={() => setShowPanel(false)}
        >
          <div className="alert-panel" onClick={(e) => e.stopPropagation()}>
            <div className="alert-panel-header">
              <h3>Notifications</h3>
              <div className="alert-panel-actions">
                <button
                  className="icon-btn"
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  title={soundEnabled ? "Mute sounds" : "Enable sounds"}
                >
                  <Volume2 size={18} className={soundEnabled ? "" : "muted"} />
                </button>
                <button
                  className="icon-btn"
                  onClick={() => setNotificationsEnabled(!notificationsEnabled)}
                  title={
                    notificationsEnabled
                      ? "Disable notifications"
                      : "Enable notifications"
                  }
                >
                  {notificationsEnabled ? (
                    <Bell size={18} />
                  ) : (
                    <BellOff size={18} />
                  )}
                </button>
                <button
                  className="icon-btn"
                  onClick={() => setShowPanel(false)}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {unreadCount > 0 && (
              <button className="mark-all-read" onClick={markAllAsRead}>
                Mark all as read
              </button>
            )}

            <div className="alert-list">
              {alerts.length === 0 ? (
                <div className="alert-empty">
                  <Bell size={32} />
                  <span>No notifications</span>
                </div>
              ) : (
                alerts.map((alert) => {
                  const alertType = ALERT_TYPES[alert.type] || ALERT_TYPES.info;
                  const Icon = alertType.icon;

                  return (
                    <div
                      key={alert.id}
                      className={`alert-item ${alert.type} ${
                        alert.read ? "read" : ""
                      }`}
                      onClick={() => markAsRead(alert.id)}
                      style={{
                        "--alert-color": alertType.color,
                        "--alert-bg": alertType.bgColor,
                        "--alert-border": alertType.borderColor,
                      }}
                    >
                      <div className="alert-icon">
                        <Icon size={18} />
                      </div>
                      <div className="alert-content">
                        <div className="alert-header">
                          <span className="alert-title">{alert.title}</span>
                          <button
                            className="alert-dismiss"
                            onClick={(e) => {
                              e.stopPropagation();
                              dismissAlert(alert.id);
                            }}
                          >
                            <X size={14} />
                          </button>
                        </div>
                        <p className="alert-message">{alert.message}</p>
                        <div className="alert-meta">
                          {alert.location && (
                            <span className="alert-location">
                              <MapPin size={12} />
                              {alert.location.name}
                            </span>
                          )}
                          <span className="alert-time">
                            <Clock size={12} />
                            {formatTime(alert.timestamp)}
                          </span>
                        </div>
                      </div>
                      {!alert.read && <div className="unread-dot" />}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Toast Notifications for Critical Alerts */}
      <AlertToasts
        alerts={alerts.filter((a) => !a.read && a.type === "critical")}
      />
    </>
  );
}

/**
 * Toast Notifications for urgent alerts
 */
function AlertToasts({ alerts }) {
  const [visibleAlerts, setVisibleAlerts] = useState([]);

  useEffect(() => {
    // Show only the most recent unread critical alert as toast
    const latest = alerts[0];
    if (latest && !visibleAlerts.find((a) => a.id === latest.id)) {
      setVisibleAlerts((prev) => [...prev, latest]);

      // Auto-dismiss after 10 seconds
      setTimeout(() => {
        setVisibleAlerts((prev) => prev.filter((a) => a.id !== latest.id));
      }, 10000);
    }
  }, [alerts]);

  const dismissToast = (id) => {
    setVisibleAlerts((prev) => prev.filter((a) => a.id !== id));
  };

  if (visibleAlerts.length === 0) return null;

  return (
    <div className="alert-toasts">
      {visibleAlerts.map((alert) => (
        <div key={alert.id} className={`alert-toast ${alert.type}`}>
          <div className="toast-icon">
            <AlertTriangle size={20} />
          </div>
          <div className="toast-content">
            <strong>{alert.title}</strong>
            <p>{alert.message}</p>
          </div>
          <button
            className="toast-dismiss"
            onClick={() => dismissToast(alert.id)}
          >
            <X size={18} />
          </button>
        </div>
      ))}
    </div>
  );
}

/**
 * Notification Bell for Header
 */
export function NotificationBell(props) {
  return <AlertNotifications {...props} />;
}

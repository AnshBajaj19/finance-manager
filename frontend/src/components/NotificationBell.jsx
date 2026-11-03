import { useState, useEffect, useRef, useCallback } from "react";
import {
  getAlerts,
  getUnreadAlertCount,
  markAlertAsRead,
  markAllAlertsAsRead,
  deleteAlert,
} from "../api/alerts";

export const triggerDesktopNotification = (title, body) => {
  if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
    try {
      new Notification(title, {
        body,
        icon: "/favicon.ico",
      });
    } catch (e) {
      console.warn("Desktop notification error:", e);
    }
  }
};

export default function NotificationBell({ onNavigateToModule7, refreshTrigger }) {
  const [isOpen, setIsOpen] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [permission, setPermission] = useState(
    typeof window !== "undefined" && "Notification" in window ? Notification.permission : "default"
  );

  const dropdownRef = useRef(null);

  const loadUnreadCount = useCallback(async () => {
    try {
      const res = await getUnreadAlertCount();
      setUnreadCount(res.unreadCount || 0);
    } catch (err) {
      console.error("Failed to load unread count:", err);
    }
  }, []);

  const loadAlertsList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getAlerts({ limit: 15 });
      setAlerts(res.notifications || []);
      setUnreadCount(res.unreadCount || 0);
    } catch (err) {
      console.error("Failed to load alerts list:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Poll count periodically and on refresh trigger
  useEffect(() => {
    loadUnreadCount();
    const interval = setInterval(loadUnreadCount, 20000);
    return () => clearInterval(interval);
  }, [loadUnreadCount, refreshTrigger]);

  // When dropdown opens, load full list
  useEffect(() => {
    if (isOpen) {
      loadAlertsList();
    }
  }, [isOpen, loadAlertsList]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleRequestPermission = async () => {
    if ("Notification" in window) {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm === "granted") {
        triggerDesktopNotification(
          "Notifications Enabled",
          "You will receive desktop alerts for unusual spending and budget warnings."
        );
      }
    }
  };

  const handleMarkRead = async (id, e) => {
    e.stopPropagation();
    try {
      await markAlertAsRead(id);
      setAlerts((prev) =>
        prev.map((a) => (a._id === id ? { ...a, is_read: true } : a))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (err) {
      console.error("Failed to mark alert as read:", err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllAlertsAsRead();
      setAlerts((prev) => prev.map((a) => ({ ...a, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error("Failed to mark all alerts as read:", err);
    }
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    try {
      await deleteAlert(id);
      setAlerts((prev) => prev.filter((a) => a._id !== id));
      loadUnreadCount();
    } catch (err) {
      console.error("Failed to delete alert:", err);
    }
  };

  const formatTime = (iso) => {
    if (!iso) return "";
    const date = new Date(iso);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  return (
    <div className="notification-bell-container" ref={dropdownRef}>
      <button
        type="button"
        className={`bell-toggle-btn ${unreadCount > 0 ? "has-unread" : ""}`}
        onClick={() => setIsOpen((prev) => !prev)}
        title="Notifications & Alerts (Module 7)"
      >
        🔔
        {unreadCount > 0 && (
          <span className="bell-badge">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="notification-dropdown-panel">
          <div className="notif-header">
            <div className="notif-title-row">
              <strong>Alert Notifications</strong>
              {unreadCount > 0 && (
                <span className="notif-count-pill">{unreadCount} unread</span>
              )}
            </div>
            {alerts.length > 0 && (
              <button
                type="button"
                className="notif-mark-all-btn"
                onClick={handleMarkAllRead}
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Desktop Push Permission Banner */}
          {permission !== "granted" && (
            <div className="notif-push-banner">
              <span>Enable browser popups for instant spending alerts:</span>
              <button
                type="button"
                className="push-enable-btn"
                onClick={handleRequestPermission}
              >
                Enable Desktop Alerts
              </button>
            </div>
          )}

          <div className="notif-list-scroll">
            {loading ? (
              <div className="notif-empty">Loading notifications...</div>
            ) : alerts.length === 0 ? (
              <div className="notif-empty">
                <span>✨</span>
                <p>No active alerts right now.</p>
                <span className="notif-sub">
                  Unusual spending and budget breaches will appear here.
                </span>
              </div>
            ) : (
              alerts.map((alert) => (
                <div
                  key={alert._id}
                  className={`notif-item ${!alert.is_read ? "unread" : ""} severity-${alert.severity}`}
                  onClick={() => {
                    if (!alert.is_read) handleMarkRead(alert._id, { stopPropagation: () => {} });
                    if (onNavigateToModule7) onNavigateToModule7();
                    setIsOpen(false);
                  }}
                >
                  <div className="notif-item-top">
                    <span className={`notif-severity-badge ${alert.severity}`}>
                      {alert.severity === "danger" ? "🚨" : "⚠️"} {alert.title}
                    </span>
                    <span className="notif-time">{formatTime(alert.createdAt)}</span>
                  </div>

                  <p className="notif-message">{alert.message}</p>

                  <div className="notif-item-footer">
                    {alert.email_sent ? (
                      <span className="notif-email-sent-tag">
                        📧 Alert emailed to your inbox
                      </span>
                    ) : (
                      <span />
                    )}
                    <div className="notif-actions">
                      {!alert.is_read && (
                        <button
                          type="button"
                          className="notif-action-btn"
                          onClick={(e) => handleMarkRead(alert._id, e)}
                          title="Mark as read"
                        >
                          ✓ Read
                        </button>
                      )}
                      <button
                        type="button"
                        className="notif-action-btn danger"
                        onClick={(e) => handleDelete(alert._id, e)}
                        title="Dismiss alert"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="notif-footer-bar">
            <button
              type="button"
              className="notif-view-all-btn"
              onClick={() => {
                setIsOpen(false);
                if (onNavigateToModule7) onNavigateToModule7();
              }}
            >
              Open Module 7 Alerts & Anomalies Hub ➔
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


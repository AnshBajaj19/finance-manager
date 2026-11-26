import { useState, useEffect, useCallback } from "react";
import {
  getAlerts,
  markAlertAsRead,
  markAllAlertsAsRead,
  deleteAlert,
  scanAnomalies,
  getAlertSettings,
  updateAlertSettings,
  sendTestEmailAlert,
  simulateAnomaly,
} from "../api/alerts";

const formatMoney = (n) => {
  if (n === null || n === undefined || isNaN(n)) return "₹0";
  if (n < 0) return `-₹${Math.abs(Math.round(n)).toLocaleString()}`;
  return `₹${Math.round(n).toLocaleString()}`;
};

export default function AlertsAndAnomalyDetection({ onNavigateToBudget }) {
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [historicalAnomalies, setHistoricalAnomalies] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [settings, setSettings] = useState(null);
  const [userEmail, setUserEmail] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSavedSuccess, setSettingsSavedSuccess] = useState(false);

  // Email test state
  const [sendingTestEmail, setSendingTestEmail] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState(null);

  // Simulation state
  const [simAmount, setSimAmount] = useState("4500");
  const [simCategory, setSimCategory] = useState("Food");
  const [simResult, setSimResult] = useState(null);
  const [simulating, setSimulating] = useState(false);

  // Load all initial data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [alertsRes, anomaliesRes, settingsRes] = await Promise.all([
        getAlerts({ limit: 50 }),
        scanAnomalies(),
        getAlertSettings(),
      ]);

      setAlerts(alertsRes.notifications || []);
      setUnreadCount(alertsRes.unreadCount || 0);
      setHistoricalAnomalies(anomaliesRes.anomalies || []);
      setSettings(settingsRes.settings);
      setUserEmail(settingsRes.userEmail || "");
    } catch (err) {
      console.error("Failed to load alerts & anomaly data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // On-demand anomaly re-scan
  const handleRunScan = async () => {
    setScanning(true);
    try {
      const res = await scanAnomalies();
      setHistoricalAnomalies(res.anomalies || []);
      const alertsRes = await getAlerts({ limit: 50 });
      setAlerts(alertsRes.notifications || []);
      setUnreadCount(alertsRes.unreadCount || 0);
    } catch (err) {
      console.error("Failed to scan anomalies:", err);
    } finally {
      setScanning(false);
    }
  };

  // Test email alert
  const handleSendTestEmail = async () => {
    setSendingTestEmail(true);
    setTestEmailResult(null);
    try {
      const res = await sendTestEmailAlert();
      setTestEmailResult(res);
    } catch (err) {
      setTestEmailResult({
        error: err.response?.data?.message || "Failed to dispatch test email.",
      });
    } finally {
      setSendingTestEmail(false);
    }
  };

  // Run simulation
  const handleRunSimulation = async (e) => {
    e.preventDefault();
    setSimulating(true);
    try {
      const res = await simulateAnomaly({
        amount: Number(simAmount),
        category: simCategory,
      });
      setSimResult(res);
    } catch (err) {
      console.error("Simulation failed:", err);
    } finally {
      setSimulating(false);
    }
  };

  // Save settings
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSavingSettings(true);
    setSettingsSavedSuccess(false);
    try {
      const res = await updateAlertSettings(settings);
      setSettings(res.settings);
      setSettingsSavedSuccess(true);
      setTimeout(() => setSettingsSavedSuccess(false), 3500);
    } catch (err) {
      console.error("Failed to save settings:", err);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleMarkRead = async (id) => {
    try {
      await markAlertAsRead(id);
      setAlerts((prev) => prev.map((a) => (a._id === id ? { ...a, is_read: true } : a)));
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch (err) {
      console.error("Failed to mark read:", err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllAlertsAsRead();
      setAlerts((prev) => prev.map((a) => ({ ...a, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error("Failed to mark all read:", err);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteAlert(id);
      setAlerts((prev) => prev.filter((a) => a._id !== id));
      const res = await getAlerts({ limit: 50 });
      setUnreadCount(res.unreadCount || 0);
    } catch (err) {
      console.error("Failed to delete alert:", err);
    }
  };

  return (
    <div className="module7-container">
      {/* Header Bar */}
      <div className="budget-header-bar">
        <div>
          <h3>Alerts & Anomaly Detection</h3>
          <p className="subtitle" style={{ margin: 0 }}>
            Proactive spending outlier detection via statistical Z-Score & rule thresholds with instant in-app and email alerts
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button
            type="button"
            className="secondary"
            onClick={handleRunScan}
            disabled={scanning}
          >
            {scanning ? "Scanning Data..." : "🔍 Run Anomaly Scan"}
          </button>
          <button
            type="button"
            onClick={handleSendTestEmail}
            disabled={sendingTestEmail}
            title={`Send test alert to ${userEmail}`}
          >
            {sendingTestEmail ? "Sending Email..." : "📧 Test Email Alert"}
          </button>
        </div>
      </div>

      {/* Test Email Result Banner */}
      {testEmailResult && (
        <div
          className={`test-email-banner ${testEmailResult.error ? "error" : "success"}`}
          style={{
            background: testEmailResult.error ? "#fee2e2" : "#dcfce7",
            color: testEmailResult.error ? "#991b1b" : "#166534",
            padding: "12px 16px",
            borderRadius: "8px",
            marginBottom: "18px",
            border: `1px solid ${testEmailResult.error ? "#fca5a5" : "#bbf7d0"}`,
          }}
        >
          {testEmailResult.error ? (
            <div>⚠️ {testEmailResult.error}</div>
          ) : (
            <div>
              <strong>✓ Email Alert Sent!</strong> Delivered to <strong>{testEmailResult.recipient}</strong>.
              {testEmailResult.previewUrl && (
                <div style={{ marginTop: "6px" }}>
                  <a
                    href={testEmailResult.previewUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: "#15803d", fontWeight: 700, textDecoration: "underline" }}
                  >
                    View Ethereal Email Preview ↗
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Top Level Metric Cards */}
      <div className="anomaly-stats-grid">
        <div className="anomaly-stat-card">
          <span className="stat-label">Unusual Expenses Flagged</span>
          <span className="stat-value text-red">{historicalAnomalies.length}</span>
          <span className="stat-sub">Statistical outliers across transactions</span>
        </div>

        <div className="anomaly-stat-card">
          <span className="stat-label">Active Unread Alerts</span>
          <span className="stat-value text-primary">{unreadCount}</span>
          <span className="stat-sub">
            {unreadCount > 0 ? "Requires review" : "All alerts caught up"}
          </span>
        </div>

        <div className="anomaly-stat-card">
          <span className="stat-label">Email Alerts Channel</span>
          <span className="stat-value text-green">
            {settings?.email_alerts_enabled ? "Active" : "Disabled"}
          </span>
          <span className="stat-sub">{userEmail || "Configured for your user"}</span>
        </div>

        <div className="anomaly-stat-card">
          <span className="stat-label">Sensitivity Threshold</span>
          <span className="stat-value">
            {settings?.anomaly_threshold_multiplier || 2.5}x
          </span>
          <span className="stat-sub">Category average spike trigger</span>
        </div>
      </div>

      {/* Interactive Simulation & Test Workbench */}
      <div className="anomaly-card" style={{ marginTop: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", marginBottom: "12px" }}>
          <div>
            <h4 style={{ margin: 0, fontSize: "16px" }}>
              🧪 Live Anomaly Detection Workbench
            </h4>
            <p style={{ margin: "2px 0 0", fontSize: "13px", color: "var(--text-muted)" }}>
              Test how the algorithm evaluates transactions (e.g. normal ₹200–₹500 vs sudden ₹4,500 spike)
            </p>
          </div>
          <span className="sim-formula-tag">
            Engine: Category Multiplier + Z-Score Outlier
          </span>
        </div>

        <form onSubmit={handleRunSimulation} className="sim-form-row">
          <div style={{ flex: "1 1 180px" }}>
            <label htmlFor="simCat">Category:</label>
            <select
              id="simCat"
              value={simCategory}
              onChange={(e) => setSimCategory(e.target.value)}
              style={{ width: "100%" }}
            >
              <option value="Food">Food</option>
              <option value="Transport">Transport</option>
              <option value="Shopping">Shopping</option>
              <option value="Bills">Bills</option>
              <option value="Entertainment">Entertainment</option>
              <option value="Healthcare">Healthcare</option>
              <option value="Education">Education</option>
              <option value="Rent/Housing">Rent/Housing</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div style={{ flex: "1 1 180px" }}>
            <label htmlFor="simAmt">Transaction Amount (₹):</label>
            <input
              id="simAmt"
              type="number"
              min="1"
              value={simAmount}
              onChange={(e) => setSimAmount(e.target.value)}
              placeholder="e.g. 4500"
              style={{ width: "100%" }}
            />
          </div>

          <div style={{ alignSelf: "flex-end" }}>
            <button type="submit" disabled={simulating} style={{ minWidth: "150px" }}>
              {simulating ? "Evaluating..." : "Test Anomaly"}
            </button>
          </div>
        </form>

        {simResult && (
          <div
            className={`sim-result-box ${simResult.isAnomaly ? "is-anomaly" : "is-normal"}`}
            style={{
              marginTop: "16px",
              padding: "14px 18px",
              borderRadius: "8px",
              background: simResult.isAnomaly ? "#fef2f2" : "#f0fdf4",
              border: `1px solid ${simResult.isAnomaly ? "#fecaca" : "#bbf7d0"}`,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
              <span style={{ fontSize: "20px" }}>
                {simResult.isAnomaly ? "🚨" : "✅"}
              </span>
              <strong style={{ fontSize: "15px", color: simResult.isAnomaly ? "#dc2626" : "#16a34a" }}>
                {simResult.isAnomaly
                  ? "Unusual Expense Detected!"
                  : "Normal Spending Pattern"}
              </strong>
            </div>

            <p style={{ margin: "4px 0 8px", fontSize: "13.5px", color: "#334155" }}>
              {simResult.reason ||
                (simResult.isAnomaly
                  ? "This amount significantly deviates from historical records."
                  : `Amount of ₹${Number(simAmount).toLocaleString()} is within normal bounds for ${simCategory}.`)}
            </p>

            <div style={{ display: "flex", gap: "18px", fontSize: "12.5px", color: "var(--text-muted)", flexWrap: "wrap" }}>
              {simResult.categoryAverage > 0 && (
                <span>
                  Category Baseline Average: <strong>{formatMoney(simResult.categoryAverage)}</strong>
                </span>
              )}
              {simResult.multiplier > 0 && (
                <span>
                  Multiplier Factor: <strong>{simResult.multiplier.toFixed(1)}x</strong>
                </span>
              )}
              {simResult.zScore !== null && simResult.zScore !== undefined && (
                <span>
                  Statistical Z-Score: <strong>{simResult.zScore.toFixed(2)}</strong>
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Historical Outliers Detected */}
      <div className="anomaly-card" style={{ marginTop: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", flexWrap: "wrap" }}>
          <div>
            <h4 style={{ margin: 0, fontSize: "16px" }}>
              📊 Outliers & Unusual Spending Detected in Your History
            </h4>
            <p style={{ margin: "2px 0 0", fontSize: "13px", color: "var(--text-muted)" }}>
              Expenses that significantly exceeded your normal spending behavior
            </p>
          </div>
          <span className="badge-count">
            {historicalAnomalies.length} detected
          </span>
        </div>

        {historicalAnomalies.length === 0 ? (
          <div className="empty-state-card">
            <span>✨</span>
            <p style={{ margin: "6px 0 2px", fontWeight: 600 }}>No spending anomalies found</p>
            <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>
              Your transactions are currently consistent with category baselines.
            </span>
          </div>
        ) : (
          <div className="anomalies-list-grid">
            {historicalAnomalies.map((item, idx) => (
              <div key={idx} className="anomaly-item-card">
                <div className="item-card-top">
                  <div>
                    <span className={`severity-tag ${item.severity}`}>
                      {item.severity === "danger" ? "🚨 Extreme Spike" : "⚠️ Unusual Expense"}
                    </span>
                    <h5 className="item-title">{item.description}</h5>
                    <span className="item-cat-date">
                      {item.category} · {new Date(item.date).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="item-amount-wrap">
                    <span className="item-amount">{formatMoney(item.amount)}</span>
                    <span className="item-multiplier">{item.multiplier}x typical avg</span>
                  </div>
                </div>

                <div className="item-card-metrics">
                  <div className="metric-box">
                    <span className="metric-lbl">Baseline Avg</span>
                    <span className="metric-v">{formatMoney(item.categoryAverage)}</span>
                  </div>
                  <div className="metric-box">
                    <span className="metric-lbl">Z-Score</span>
                    <span className="metric-v">{item.zScore}</span>
                  </div>
                  <div className="metric-box">
                    <span className="metric-lbl">Payment Method</span>
                    <span className="metric-v">{item.payment_method || "UPI"}</span>
                  </div>
                </div>

                <p className="item-reason">{item.reason}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dispatched Notification Alerts List */}
      <div className="anomaly-card" style={{ marginTop: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", flexWrap: "wrap" }}>
          <div>
            <h4 style={{ margin: 0, fontSize: "16px" }}>
              📬 Alert Notification Feed & Email Dispatches
            </h4>
            <p style={{ margin: "2px 0 0", fontSize: "13px", color: "var(--text-muted)" }}>
              Live record of all triggered alerts
            </p>
          </div>
          {alerts.length > 0 && (
            <button
              type="button"
              className="secondary"
              onClick={handleMarkAllRead}
              style={{ padding: "6px 12px", fontSize: "12px" }}
            >
              Mark All as Read
            </button>
          )}
        </div>

        {alerts.length === 0 ? (
          <div className="empty-state-card">
            <span>🔔</span>
            <p style={{ margin: "6px 0 2px", fontWeight: 600 }}>No alerts logged yet</p>
            <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>
              Alerts will appear here when an unusual expense occurs or a budget is exceeded.
            </span>
          </div>
        ) : (
          <div className="alerts-feed-list">
            {alerts.map((alert) => (
              <div
                key={alert._id}
                className={`alert-feed-row ${!alert.is_read ? "unread" : ""} severity-${alert.severity}`}
              >
                <div className="feed-left">
                  <span className="feed-icon">
                    {alert.severity === "danger" ? "🚨" : "⚠️"}
                  </span>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                      <strong className="feed-title">{alert.title}</strong>
                      <span className="feed-time">
                        {new Date(alert.createdAt).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      {alert.email_sent && (
                        <span className="email-sent-badge">
                          📧 Emailed to {alert.email_recipient || userEmail}
                        </span>
                      )}
                    </div>
                    <p className="feed-message">{alert.message}</p>
                  </div>
                </div>

                <div className="feed-actions">
                  {!alert.is_read && (
                    <button
                      type="button"
                      className="feed-btn read"
                      onClick={() => handleMarkRead(alert._id)}
                      title="Mark as read"
                    >
                      ✓ Mark read
                    </button>
                  )}
                  <button
                    type="button"
                    className="feed-btn delete"
                    onClick={() => handleDelete(alert._id)}
                    title="Delete alert"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Settings & Preferences */}
      {settings && (
        <div className="anomaly-card" style={{ marginTop: "20px" }}>
          <h4 style={{ margin: "0 0 12px 0", fontSize: "16px" }}>
            ⚙️ Notification & Email Alert Settings
          </h4>
          <p style={{ margin: "0 0 16px 0", fontSize: "13px", color: "var(--text-muted)" }}>
            Configure how and when the system alerts you regarding unusual financial behavior
          </p>

          {settingsSavedSuccess && (
            <div style={{ background: "#dcfce7", color: "#166534", padding: "10px 14px", borderRadius: "6px", marginBottom: "14px", fontWeight: 500 }}>
              ✓ Alert preferences updated successfully!
            </div>
          )}

          <form onSubmit={handleSaveSettings}>
            <div className="settings-toggles-grid">
              <label className="toggle-label">
                <input
                  type="checkbox"
                  checked={settings.email_alerts_enabled}
                  onChange={(e) =>
                    setSettings({ ...settings, email_alerts_enabled: e.target.checked })
                  }
                />
                <div>
                  <strong>Send Email Alerts to {userEmail || "your registered email"}</strong>
                  <span className="toggle-sub">
                    Dispatches rich HTML alert emails with expense breakdown and anomaly diagnostics
                  </span>
                </div>
              </label>

              <label className="toggle-label">
                <input
                  type="checkbox"
                  checked={settings.notify_unusual_expenses}
                  onChange={(e) =>
                    setSettings({ ...settings, notify_unusual_expenses: e.target.checked })
                  }
                />
                <div>
                  <strong>Alert on Unusual Expenses</strong>
                  <span className="toggle-sub">
                    Flags individual transactions exceeding your normal category multiplier or Z-Score
                  </span>
                </div>
              </label>

              <label className="toggle-label">
                <input
                  type="checkbox"
                  checked={settings.notify_budget_exceeded}
                  onChange={(e) =>
                    setSettings({ ...settings, notify_budget_exceeded: e.target.checked })
                  }
                />
                <div>
                  <strong>Alert on Budget Exceeded</strong>
                  <span className="toggle-sub">
                    Triggers instant alert and email when an expense pushes category spending beyond 100%
                  </span>
                </div>
              </label>
            </div>

            <div className="settings-inputs-grid" style={{ marginTop: "16px" }}>
              <div>
                <label htmlFor="multThreshold">
                  Anomaly Multiplier Threshold (x of Category Average):
                </label>
                <select
                  id="multThreshold"
                  value={settings.anomaly_threshold_multiplier}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      anomaly_threshold_multiplier: Number(e.target.value),
                    })
                  }
                  style={{ width: "100%" }}
                >
                  <option value={2.0}>2.0x (High sensitivity)</option>
                  <option value={2.5}>2.5x (Recommended default)</option>
                  <option value={3.0}>3.0x (Moderate sensitivity)</option>
                  <option value={4.0}>4.0x (Low sensitivity - large spikes only)</option>
                </select>
              </div>

              <div>
                <label htmlFor="zThreshold">
                  Statistical Z-Score Threshold:
                </label>
                <select
                  id="zThreshold"
                  value={settings.z_score_threshold}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      z_score_threshold: Number(e.target.value),
                    })
                  }
                  style={{ width: "100%" }}
                >
                  <option value={1.8}>1.8 (Sensitive)</option>
                  <option value={2.0}>2.0 (Standard 95% Confidence Outlier)</option>
                  <option value={2.5}>2.5 (Strict Outlier)</option>
                  <option value={3.0}>3.0 (Extreme 99% Outlier)</option>
                </select>
              </div>
            </div>

            <div style={{ marginTop: "18px", display: "flex", justifyContent: "flex-end" }}>
              <button type="submit" disabled={savingSettings}>
                {savingSettings ? "Saving Settings..." : "Save Settings"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}


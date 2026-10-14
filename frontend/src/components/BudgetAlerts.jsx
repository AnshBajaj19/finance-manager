export default function BudgetAlerts({ alerts = [], onNavigateToBudget }) {
  if (!alerts || alerts.length === 0) return null;

  return (
    <section className="budget-alerts-section">
      {alerts.map((alert, idx) => (
        <div
          key={idx}
          className={`budget-alert-item ${alert.type === "danger" ? "danger" : "warning"}`}
        >
          <div className="budget-alert-content">
            <span className="budget-alert-icon">
              {alert.type === "danger" ? "🚨" : "⚠️"}
            </span>
            <span>{alert.message}</span>
          </div>
          {onNavigateToBudget && (
            <button
              className="secondary"
              style={{ fontSize: "12px", padding: "4px 10px" }}
              onClick={onNavigateToBudget}
            >
              Manage Budget
            </button>
          )}
        </div>
      ))}
    </section>
  );
}

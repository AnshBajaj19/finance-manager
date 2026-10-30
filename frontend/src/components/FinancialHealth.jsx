import { useState, useEffect, useCallback } from "react";
import { getFinancialHealth } from "../api/financialHealth";

const formatMoney = (n) => {
  if (n === null || n === undefined || isNaN(n)) return "₹0";
  if (n < 0) return `-₹${Math.abs(Math.round(n)).toLocaleString()}`;
  return `₹${Math.round(n).toLocaleString()}`;
};

export default function FinancialHealth({ currentMonth, onNavigateToBudget }) {
  const [selectedMonth, setSelectedMonth] = useState(
    () => currentMonth || new Date().toISOString().slice(0, 7)
  );
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Interactive Score Improvement Simulator
  const [simShoppingCut, setSimShoppingCut] = useState(15);
  const [simBudgetAdherence, setSimBudgetAdherence] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getFinancialHealth(selectedMonth);
      setData(res);
    } catch (err) {
      console.error("Failed to load financial health:", err);
      setError("Unable to compute financial health assessment. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [selectedMonth]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Compute simulated improved score
  const calculateSimulatedScore = () => {
    if (!data) return null;
    let score = data.financialHealthScore;

    // If user simulates cutting shopping
    const shoppingAmt = data.categoryBreakdown?.["Shopping"] || 0;
    if (shoppingAmt > 0 && simShoppingCut > 0) {
      const saved = (shoppingAmt * simShoppingCut) / 100;
      const newSavings = data.metrics.currentSavings + saved;
      const newSavingsRatio = data.metrics.monthlyIncome > 0
        ? (newSavings / data.metrics.monthlyIncome) * 100
        : 0;

      // Bonus points for moving to higher savings tier
      if (newSavingsRatio >= 25 && data.metrics.savingsRatio < 25) score += 5;
      else if (newSavingsRatio >= 20 && data.metrics.savingsRatio < 20) score += 6;

      // Discretionary bonus
      score += 3;
    }

    // If user simulates achieving full budget adherence
    if (simBudgetAdherence && data.metrics.budgetsExceeded > 0) {
      score += data.metrics.budgetsExceeded * 4;
    } else if (simBudgetAdherence && data.metrics.budgetsActive === 0) {
      score += 6;
    }

    return Math.min(100, Math.round(score));
  };

  const getPillarProgressColor = (score, max) => {
    const ratio = score / max;
    if (ratio >= 0.8) return "#16a34a"; // green
    if (ratio >= 0.6) return "#2563eb"; // blue
    if (ratio >= 0.4) return "#d97706"; // amber
    return "#dc2626"; // red
  };

  const getPriorityBadgeClass = (priority) => {
    switch (priority) {
      case "high":
        return "priority-badge-high";
      case "medium":
        return "priority-badge-medium";
      default:
        return "priority-badge-low";
    }
  };

  const simulatedScore = calculateSimulatedScore();

  return (
    <div className="financial-health-container">
      {/* Header & Month Filter */}
      <div className="budget-header-bar">
        <div>
          <h3>Financial Health Analysis (Module 5)</h3>
          <p className="subtitle" style={{ margin: 0 }}>
            Comprehensive behavioral assessment evaluating savings ratio, expense-to-income, and budget adherence
          </p>
        </div>
        <div className="budget-month-controls">
          <label style={{ margin: 0, alignSelf: "center", fontSize: "13px" }}>
            Assessment Month:
          </label>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
          />
          <button onClick={loadData} className="secondary" disabled={loading}>
            {loading ? "Analyzing..." : "Refresh"}
          </button>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {loading ? (
        <p>Analyzing your financial health data...</p>
      ) : data ? (
        <>
          {/* Main Hero Score Meter Card */}
          <div className="health-score-hero-card">
            <div className="health-score-main">
              <div className="health-score-circle">
                <span className="health-score-number">{data.financialHealthScore}</span>
                <span className="health-score-out-of">/ 100</span>
              </div>
              <div className="health-score-details">
                <div className="health-grade-row">
                  <span
                    className="health-grade-badge"
                    style={{ backgroundColor: data.gradeColor }}
                  >
                    ● {data.grade} Financial Health
                  </span>
                  <span className="health-month-tag">{data.month}</span>
                </div>
                <h4 className="health-hero-title">Financial Health Assessment</h4>
                <p className="health-hero-summary">{data.summary}</p>
              </div>
            </div>

            {/* Quick Metrics Bar */}
            <div className="health-metrics-row">
              <div className="health-metric-tile">
                <span className="h-metric-label">Savings Ratio</span>
                <span
                  className="h-metric-val"
                  style={{
                    color: data.metrics.savingsRatio >= 20 ? "#16a34a" : data.metrics.savingsRatio >= 10 ? "#2563eb" : "#dc2626",
                  }}
                >
                  {data.metrics.savingsRatio}%
                </span>
                <span className="h-metric-sub">Target: ≥ 20%</span>
              </div>

              <div className="health-metric-tile">
                <span className="h-metric-label">Expense Ratio</span>
                <span
                  className="h-metric-val"
                  style={{
                    color: data.metrics.expenseRatio <= 75 ? "#16a34a" : "#dc2626",
                  }}
                >
                  {data.metrics.expenseRatio}%
                </span>
                <span className="h-metric-sub">Target: ≤ 75%</span>
              </div>

              <div className="health-metric-tile">
                <span className="h-metric-label">Discretionary Ratio</span>
                <span
                  className="h-metric-val"
                  style={{
                    color: data.metrics.discretionaryRatio <= 30 ? "#16a34a" : "#d97706",
                  }}
                >
                  {data.metrics.discretionaryRatio}%
                </span>
                <span className="h-metric-sub">Shopping & Leisure</span>
              </div>

              <div className="health-metric-tile">
                <span className="h-metric-label">Budget Adherence</span>
                <span
                  className="h-metric-val"
                  style={{
                    color: data.metrics.budgetsExceeded === 0 ? "#16a34a" : "#dc2626",
                  }}
                >
                  {data.metrics.budgetsActive > 0
                    ? `${data.metrics.budgetsActive - data.metrics.budgetsExceeded}/${data.metrics.budgetsActive} Met`
                    : "None Set"}
                </span>
                <span className="h-metric-sub">
                  {data.metrics.budgetsExceeded > 0 ? `${data.metrics.budgetsExceeded} Exceeded` : "On Track"}
                </span>
              </div>
            </div>
          </div>

          {/* 5 Scoring Pillars */}
          <div className="health-pillars-card">
            <h4>📊 5 Pillars of Financial Health</h4>
            <p className="subtitle" style={{ margin: "0 0 16px" }}>
              Your score is computed across 5 weighted dimensions defined in standard financial wellness frameworks:
            </p>

            <div className="pillars-grid">
              {data.pillars.map((pillar, idx) => {
                const pct = Math.round((pillar.score / pillar.weight) * 100);
                const barColor = getPillarProgressColor(pillar.score, pillar.weight);
                return (
                  <div key={pillar.name} className="pillar-item">
                    <div className="pillar-header">
                      <div className="pillar-title-wrap">
                        <span className="pillar-num">{idx + 1}</span>
                        <strong>{pillar.name}</strong>
                      </div>
                      <span className="pillar-score">
                        <strong>{pillar.score}</strong> / {pillar.weight} pts
                      </span>
                    </div>

                    <div className="pillar-progress-track">
                      <div
                        className="pillar-progress-fill"
                        style={{ width: `${pct}%`, backgroundColor: barColor }}
                      />
                    </div>

                    <div className="pillar-meta-row">
                      <span className="pillar-rating-pill" style={{ borderColor: barColor, color: barColor }}>
                        {pillar.rating}
                      </span>
                      <span className="pillar-actual">
                        Actual: <strong>{pillar.actual}</strong> ({pillar.target})
                      </span>
                    </div>
                    <p className="pillar-desc">{pillar.description}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Actionable Rule-Based Recommendations */}
          <div className="health-recs-card">
            <div className="recs-header">
              <div>
                <h4>🎯 Personalized Action Recommendations</h4>
                <p className="subtitle" style={{ margin: "0" }}>
                  Automated rule-based recommendations tailored to your spending and budget patterns:
                </p>
              </div>
            </div>

            <div className="recs-list">
              {data.recommendations.map((rec) => (
                <div key={rec.id} className="rec-card">
                  <div className="rec-header">
                    <div className="rec-title-group">
                      <span className={`priority-tag ${getPriorityBadgeClass(rec.priority)}`}>
                        {rec.priority.toUpperCase()} PRIORITY
                      </span>
                      <strong>{rec.title}</strong>
                    </div>
                    <span className="rec-impact-badge">{rec.impact}</span>
                  </div>
                  <p className="rec-message">{rec.message}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Interactive Health Score Simulator */}
          <div className="health-simulator-card">
            <h4>🎛️ Interactive Score Improvement Simulator</h4>
            <p className="subtitle" style={{ margin: "0 0 16px" }}>
              See how adopting smart financial habits would raise your score:
            </p>

            <div className="sim-controls-grid">
              <div className="sim-control-item">
                <label>Trim Shopping Expenses by (%):</label>
                <div style={{ display: "flex", gap: "8px", marginTop: "6px" }}>
                  {[0, 10, 15, 25].map((val) => (
                    <button
                      key={val}
                      type="button"
                      className={simShoppingCut === val ? "" : "secondary"}
                      onClick={() => setSimShoppingCut(val)}
                      style={{ padding: "4px 12px", fontSize: "12px", margin: 0 }}
                    >
                      {val === 0 ? "0%" : `-${val}%`}
                    </button>
                  ))}
                </div>
                <span style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px", display: "block" }}>
                  Monthly Shopping: {formatMoney(data.categoryBreakdown?.["Shopping"] || 0)}
                </span>
              </div>

              <div className="sim-control-item">
                <label>Budget Discipline (Module 3):</label>
                <div style={{ display: "flex", gap: "8px", marginTop: "6px" }}>
                  <button
                    type="button"
                    className={simBudgetAdherence ? "" : "secondary"}
                    onClick={() => setSimBudgetAdherence(true)}
                    style={{ padding: "4px 12px", fontSize: "12px", margin: 0 }}
                  >
                    100% Adherence
                  </button>
                  <button
                    type="button"
                    className={!simBudgetAdherence ? "" : "secondary"}
                    onClick={() => setSimBudgetAdherence(false)}
                    style={{ padding: "4px 12px", fontSize: "12px", margin: 0 }}
                  >
                    Current
                  </button>
                </div>
                <span style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px", display: "block" }}>
                  {data.metrics.budgetsActive > 0 ? `${data.metrics.budgetsActive} Active Budgets` : "No budgets set"}
                </span>
              </div>
            </div>

            <div className="sim-score-outcome-box">
              <div className="sim-outcome-header">
                <span>Current Score: <strong>{data.financialHealthScore}/100</strong></span>
                <span className="sim-arrow">➔</span>
                <span>Projected Score: <strong className="sim-new-score">{simulatedScore}/100</strong></span>
                {simulatedScore > data.financialHealthScore && (
                  <span className="score-increase-tag">
                    +{simulatedScore - data.financialHealthScore} Points
                  </span>
                )}
              </div>
              <p style={{ margin: "8px 0 0", fontSize: "13px", color: "#1e40af" }}>
                💡 Following these two habits lifts your financial standing and ensures a solid safety cushion.
              </p>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

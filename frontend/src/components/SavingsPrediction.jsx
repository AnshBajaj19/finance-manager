import { useState, useEffect, useCallback } from "react";
import {
  getSavingsPrediction,
  simulateSavings,
  getSavingsModelInfo,
} from "../api/savings";

const formatMoney = (n) => {
  if (n === null || n === undefined || isNaN(n)) return "₹0";
  if (n < 0) return `-₹${Math.abs(Math.round(n)).toLocaleString()}`;
  return `₹${Math.round(n).toLocaleString()}`;
};

export default function SavingsPrediction({ currentMonth }) {
  const [selectedMonth, setSelectedMonth] = useState(
    () => currentMonth || new Date().toISOString().slice(0, 7)
  );
  const [predictionData, setPredictionData] = useState(null);
  const [modelInfo, setModelInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Simulator state
  const [simIncome, setSimIncome] = useState("45000");
  const [simFood, setSimFood] = useState("6000");
  const [simTransport, setSimTransport] = useState("3500");
  const [simShopping, setSimShopping] = useState("4000");
  const [simBills, setSimBills] = useState("6500");
  const [simPrevSavings, setSimPrevSavings] = useState("10000");
  const [simResult, setSimResult] = useState(null);
  const [simulating, setSimulating] = useState(false);

  // Load automated prediction and model evaluation info
  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [predRes, infoRes] = await Promise.all([
        getSavingsPrediction(selectedMonth),
        getSavingsModelInfo().catch(() => null),
      ]);
      setPredictionData(predRes);
      if (infoRes) setModelInfo(infoRes);

      // Pre-fill simulator with user's actual features if available
      if (predRes?.features_used) {
        const feat = predRes.features_used;
        if (feat.monthly_income > 0) setSimIncome(String(feat.monthly_income));
        if (feat.food_expenses > 0) setSimFood(String(feat.food_expenses));
        if (feat.transport_expenses > 0) setSimTransport(String(feat.transport_expenses));
        if (feat.shopping_expenses > 0) setSimShopping(String(feat.shopping_expenses));
        if (feat.bills_expenses > 0) setSimBills(String(feat.bills_expenses));
        if (feat.previous_savings > 0) setSimPrevSavings(String(feat.previous_savings));
      }
    } catch (err) {
      console.error("Failed to load savings prediction:", err);
      setError("Unable to compute savings prediction. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [selectedMonth]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle what-if simulation
  const handleRunSimulation = async (e) => {
    e.preventDefault();
    setSimulating(true);
    try {
      const food = Number(simFood) || 0;
      const trans = Number(simTransport) || 0;
      const shop = Number(simShopping) || 0;
      const bills = Number(simBills) || 0;
      const totalExp = food + trans + shop + bills;

      const payload = {
        monthly_income: Number(simIncome) || 0,
        total_expenses: totalExp,
        food_expenses: food,
        transport_expenses: trans,
        shopping_expenses: shop,
        bills_expenses: bills,
        previous_savings: Number(simPrevSavings) || 0,
        month: Number(selectedMonth.split("-")[1]) || new Date().getMonth() + 1,
      };

      const res = await simulateSavings(payload);
      setSimResult(res);
    } catch (err) {
      console.error("Simulation error:", err);
      alert("Failed to run simulation.");
    } finally {
      setSimulating(false);
    }
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case "excellent":
      case "healthy":
        return "savings-badge-healthy";
      case "moderate":
        return "savings-badge-moderate";
      case "tight":
        return "savings-badge-tight";
      case "deficit":
        return "savings-badge-deficit";
      default:
        return "savings-badge-moderate";
    }
  };

  return (
    <div className="savings-prediction-container">
      {/* Top Header & Month Filter */}
      <div className="budget-header-bar">
        <div>
          <h3>Monthly Savings Prediction (Module 4)</h3>
          <p className="subtitle" style={{ margin: 0 }}>
            Machine Learning regression forecasting your expected end-of-month savings
          </p>
        </div>
        <div className="budget-month-controls">
          <label style={{ margin: 0, alignSelf: "center", fontSize: "13px" }}>
            Target Month:
          </label>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
          />
          <button onClick={loadData} className="secondary" disabled={loading}>
            {loading ? "Calculating..." : "Refresh"}
          </button>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {/* Main Hero Prediction Card */}
      {predictionData && (
        <div className="savings-hero-card">
          <div className="savings-hero-top">
            <div>
              <span className="savings-hero-subtitle">
                Projected Savings · {selectedMonth}
              </span>
              <div className="savings-hero-amount">
                {formatMoney(predictionData.predicted_savings)}
              </div>
              <div className="savings-hero-rate">
                Expected Savings Rate:{" "}
                <strong>{predictionData.savings_rate_percent}%</strong> of income
              </div>
            </div>
            <div className="savings-hero-badge-wrap">
              <span
                className={`savings-status-badge ${getStatusBadgeClass(
                  predictionData.status
                )}`}
              >
                ● {predictionData.status_text}
              </span>
              <div className="savings-ml-tag">
                {predictionData.mlConnected ? (
                  <span className="tag-ml-online">
                    ⚡ ML Active ({predictionData.model_metadata?.model_name || "Regression"})
                  </span>
                ) : (
                  <span className="tag-ml-offline">
                    ⚠️ Baseline Fallback (ML Offline)
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* AI Insight Box */}
          <div className="savings-insight-box">
            <span className="savings-insight-icon">💡</span>
            <div>
              <strong>Financial Insight:</strong> {predictionData.insight}
            </div>
          </div>
        </div>
      )}

      {/* Feature Breakdown: The actual variables powering the ML prediction */}
      {predictionData?.features_used && (
        <div className="savings-features-section">
          <h4>📊 ML Input Features ({selectedMonth})</h4>
          <p className="subtitle" style={{ margin: "0 0 12px" }}>
            These financial parameters were detected from your recorded transactions and fed into the regression model:
          </p>
          <div className="savings-feature-grid">
            <div className="savings-feature-item">
              <span className="feature-label">Monthly Income</span>
              <span className="feature-val income">
                {formatMoney(predictionData.features_used.monthly_income)}
              </span>
            </div>
            <div className="savings-feature-item">
              <span className="feature-label">Total Expenses</span>
              <span className="feature-val expense">
                {formatMoney(predictionData.features_used.total_expenses)}
              </span>
            </div>
            <div className="savings-feature-item">
              <span className="feature-label">Food Expenses</span>
              <span className="feature-val">
                {formatMoney(predictionData.features_used.food_expenses)}
              </span>
            </div>
            <div className="savings-feature-item">
              <span className="feature-label">Transport Expenses</span>
              <span className="feature-val">
                {formatMoney(predictionData.features_used.transport_expenses)}
              </span>
            </div>
            <div className="savings-feature-item">
              <span className="feature-label">Shopping Expenses</span>
              <span className="feature-val">
                {formatMoney(predictionData.features_used.shopping_expenses)}
              </span>
            </div>
            <div className="savings-feature-item">
              <span className="feature-label">Bills Expenses</span>
              <span className="feature-val">
                {formatMoney(predictionData.features_used.bills_expenses)}
              </span>
            </div>
            <div className="savings-feature-item">
              <span className="feature-label">Previous Savings Avg</span>
              <span className="feature-val">
                {formatMoney(predictionData.features_used.previous_savings)}
              </span>
            </div>
            <div className="savings-feature-item">
              <span className="feature-label">Calendar Month</span>
              <span className="feature-val">Month {predictionData.features_used.month}</span>
            </div>
          </div>
        </div>
      )}

      {/* Interactive What-If Simulator */}
      <div className="savings-simulator-card">
        <h4>🎛️ Interactive Savings Simulator ("What-If" Analysis)</h4>
        <p className="subtitle" style={{ margin: "0 0 16px" }}>
          Simulate how adjusting your income or cutting category spending will impact your predicted savings:
        </p>
        <form onSubmit={handleRunSimulation} className="simulator-form">
          <div className="simulator-grid">
            <div>
              <label>Monthly Income (₹)</label>
              <input
                type="number"
                min="0"
                step="500"
                value={simIncome}
                onChange={(e) => setSimIncome(e.target.value)}
                required
              />
            </div>
            <div>
              <label>Food Expenses (₹)</label>
              <input
                type="number"
                min="0"
                step="100"
                value={simFood}
                onChange={(e) => setSimFood(e.target.value)}
                required
              />
            </div>
            <div>
              <label>Transport Expenses (₹)</label>
              <input
                type="number"
                min="0"
                step="100"
                value={simTransport}
                onChange={(e) => setSimTransport(e.target.value)}
                required
              />
            </div>
            <div>
              <label>Shopping Expenses (₹)</label>
              <input
                type="number"
                min="0"
                step="100"
                value={simShopping}
                onChange={(e) => setSimShopping(e.target.value)}
                required
              />
            </div>
            <div>
              <label>Bills Expenses (₹)</label>
              <input
                type="number"
                min="0"
                step="100"
                value={simBills}
                onChange={(e) => setSimBills(e.target.value)}
                required
              />
            </div>
            <div>
              <label>Historical Savings Habit (₹)</label>
              <input
                type="number"
                min="0"
                step="500"
                value={simPrevSavings}
                onChange={(e) => setSimPrevSavings(e.target.value)}
                required
              />
            </div>
          </div>

          <div style={{ marginTop: "16px", display: "flex", alignItems: "center", gap: "12px" }}>
            <button type="submit" disabled={simulating}>
              {simulating ? "Simulating..." : "Predict Simulated Savings"}
            </button>
            <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>
              Total Expenses:{" "}
              <strong>
                {formatMoney(
                  (Number(simFood) || 0) +
                    (Number(simTransport) || 0) +
                    (Number(simShopping) || 0) +
                    (Number(simBills) || 0)
                )}
              </strong>
            </span>
          </div>
        </form>

        {simResult && (
          <div className="sim-result-box">
            <div className="sim-result-header">
              <span>Simulation Result:</span>
              <span className="sim-amount">{formatMoney(simResult.predicted_savings)}</span>
            </div>
            <div className="sim-result-details">
              <span>Savings Rate: <strong>{simResult.savings_rate_percent}%</strong></span>
              <span>Status: <strong style={{ color: "var(--primary)" }}>{simResult.status_text}</strong></span>
            </div>
            <p className="sim-insight">💡 {simResult.insight}</p>
          </div>
        )}
      </div>

      {/* Historical Monthly Savings Track Record */}
      {predictionData?.history && predictionData.history.length > 0 && (
        <div className="savings-history-section">
          <h4>📈 Monthly Savings Track Record</h4>
          <p className="subtitle" style={{ margin: "0 0 12px" }}>
            Actual historical financial performance across recorded months:
          </p>
          <div className="history-table-wrapper">
            <table className="savings-table">
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Income</th>
                  <th>Total Expenses</th>
                  <th>Net Savings</th>
                  <th>Savings Rate</th>
                </tr>
              </thead>
              <tbody>
                {predictionData.history.map((row) => (
                  <tr key={row.month} className={row.month === selectedMonth ? "highlight-row" : ""}>
                    <td>
                      <strong>{row.month}</strong>
                      {row.month === selectedMonth && <span className="current-month-tag">Selected</span>}
                    </td>
                    <td className="income">{formatMoney(row.income)}</td>
                    <td className="expense">{formatMoney(row.expenses)}</td>
                    <td style={{ color: row.savings >= 0 ? "var(--primary)" : "var(--danger)", fontWeight: 600 }}>
                      {formatMoney(row.savings)}
                    </td>
                    <td>{row.savingsRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Machine Learning Model Performance & Evaluation */}
      {modelInfo?.comparison && (
        <div className="savings-ml-eval-card">
          <div className="eval-card-header">
            <h4>🤖 ML Model Evaluation & Comparison (Module 4)</h4>
            <span className="champion-badge">
              Champion Model: <strong>{modelInfo.best_model}</strong>
            </span>
          </div>
          <p className="subtitle" style={{ margin: "0 0 14px" }}>
            In accordance with project requirements, three regression models were trained on {modelInfo.training_samples?.toLocaleString()} financial profiles and evaluated on held-out test data using MAE, RMSE, and R² Score:
          </p>

          <table className="savings-table eval-table">
            <thead>
              <tr>
                <th>Regression Model</th>
                <th>MAE (Mean Absolute Error)</th>
                <th>RMSE (Root Mean Sq Error)</th>
                <th>R² Score (Accuracy)</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {modelInfo.comparison.map((m) => {
                const isChampion = m.name === modelInfo.best_model;
                return (
                  <tr key={m.name} className={isChampion ? "champion-row" : ""}>
                    <td>
                      <strong>{m.name}</strong>
                    </td>
                    <td>₹{m.mae?.toLocaleString()}</td>
                    <td>₹{m.rmse?.toLocaleString()}</td>
                    <td>
                      <strong>{(m.r2 * 100).toFixed(2)}%</strong> ({m.r2})
                    </td>
                    <td>
                      {isChampion ? (
                        <span className="eval-status-active">🏆 Deployed Model</span>
                      ) : (
                        <span className="eval-status-evaluated">Evaluated</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="eval-metrics-explanation">
            <div>
              <strong>MAE (Mean Absolute Error):</strong> Average deviation of predictions from actual savings (lower is better).
            </div>
            <div>
              <strong>RMSE (Root Mean Squared Error):</strong> Penalizes larger prediction errors (lower is better).
            </div>
            <div>
              <strong>R² Score (Coefficient of Determination):</strong> Proportion of variance in savings explained by features (closer to 1.0 is better).
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

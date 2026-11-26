import { useState, useEffect, useCallback, useMemo } from "react";
import {
  getInvestmentProfile,
  saveInvestmentProfile,
  getInvestmentRecommendations,
  calculateSipProjection,
} from "../api/investment";

const formatMoney = (n) => {
  if (n === null || n === undefined || isNaN(n)) return "₹0";
  if (n < 0) return `-₹${Math.abs(Math.round(n)).toLocaleString()}`;
  return `₹${Math.round(n).toLocaleString()}`;
};

export default function InvestmentRecommendation({ currentMonth }) {
  const [selectedMonth, setSelectedMonth] = useState(
    () => currentMonth || new Date().toISOString().slice(0, 7)
  );

  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState("");

  // User Investment Parameters
  const [riskTolerance, setRiskTolerance] = useState("Medium");
  const [financialGoal, setFinancialGoal] = useState("Wealth Creation");
  const [investmentHorizon, setInvestmentHorizon] = useState("Medium Term (3-5 years)");
  const [emergencyFund, setEmergencyFund] = useState("0");
  const [customInvestable, setCustomInvestable] = useState("");
  const [notes, setNotes] = useState("");

  // Live Data & Results
  const [financialContext, setFinancialContext] = useState(null);
  const [recommendations, setRecommendations] = useState(null);

  // SIP Simulator State
  const [sipMonthly, setSipMonthly] = useState("5000");
  const [sipRate, setSipRate] = useState("12");
  const [sipYears, setSipYears] = useState("10");
  const [sipLumpSum, setSipLumpSum] = useState("0");
  const [sipResult, setSipResult] = useState(null);
  const [calculatingSip, setCalculatingSip] = useState(false);

  // Load Saved Profile & Initial Recommendations
  const loadProfileData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getInvestmentProfile(selectedMonth);
      if (res.profile) {
        setRiskTolerance(res.profile.risk_tolerance || "Medium");
        setFinancialGoal(res.profile.financial_goal || "Wealth Creation");
        setInvestmentHorizon(res.profile.investment_horizon || "Medium Term (3-5 years)");
        setEmergencyFund(String(res.profile.current_emergency_fund || 0));
        setCustomInvestable(
          res.profile.monthly_investable_override !== null &&
            res.profile.monthly_investable_override !== undefined
            ? String(res.profile.monthly_investable_override)
            : ""
        );
        setNotes(res.profile.notes || "");
      }
      setFinancialContext(res.financialContext);
      setRecommendations(res.recommendations);

      // Prepopulate SIP simulator from recommendations
      if (res.recommendations?.recommendedMonthlyInvest) {
        setSipMonthly(String(res.recommendations.recommendedMonthlyInvest));
      }
      if (res.recommendations?.portfolioWeightedReturn) {
        setSipRate(String(res.recommendations.portfolioWeightedReturn));
      }
    } catch (err) {
      console.error("Failed to load investment profile:", err);
      setError("Unable to load investment profile. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [selectedMonth]);

  useEffect(() => {
    loadProfileData();
  }, [loadProfileData]);

  // Recalculate SIP when simulator inputs change
  useEffect(() => {
    let cancel = false;
    const fetchSip = async () => {
      setCalculatingSip(true);
      try {
        const payload = {
          monthlyInvestment: Number(sipMonthly) || 0,
          expectedReturnAnnual: Number(sipRate) || 0,
          years: Number(sipYears) || 1,
          initialLumpSum: Number(sipLumpSum) || 0,
        };
        const res = await calculateSipProjection(payload);
        if (!cancel) setSipResult(res);
      } catch (err) {
        console.error("Failed SIP projection:", err);
      } finally {
        if (!cancel) setCalculatingSip(false);
      }
    };

    const timer = setTimeout(fetchSip, 300);
    return () => {
      cancel = true;
      clearTimeout(timer);
    };
  }, [sipMonthly, sipRate, sipYears, sipLumpSum]);

  // Dynamic recommendation update when user toggles options
  const handleRecalculate = useCallback(async (newRisk, newGoal, newHorizon, newEmergency, newCustom) => {
    try {
      const payload = {
        risk_tolerance: newRisk !== undefined ? newRisk : riskTolerance,
        financial_goal: newGoal !== undefined ? newGoal : financialGoal,
        investment_horizon: newHorizon !== undefined ? newHorizon : investmentHorizon,
        current_emergency_fund: Number(newEmergency !== undefined ? newEmergency : emergencyFund) || 0,
        custom_investable_amount:
          (newCustom !== undefined ? newCustom : customInvestable) === ""
            ? null
            : Number(newCustom !== undefined ? newCustom : customInvestable),
        month: selectedMonth,
      };
      const freshRecs = await getInvestmentRecommendations(payload);
      setRecommendations(freshRecs);

      // Update SIP simulator defaults
      if (freshRecs?.recommendedMonthlyInvest) {
        setSipMonthly(String(freshRecs.recommendedMonthlyInvest));
      }
      if (freshRecs?.portfolioWeightedReturn) {
        setSipRate(String(freshRecs.portfolioWeightedReturn));
      }
    } catch (err) {
      console.error("Failed to dynamically refresh recommendations:", err);
    }
  }, [riskTolerance, financialGoal, investmentHorizon, emergencyFund, customInvestable, selectedMonth]);

  // Handle Profile Save
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    setSaveSuccess(false);
    setError("");

    try {
      const payload = {
        risk_tolerance: riskTolerance,
        financial_goal: financialGoal,
        investment_horizon: investmentHorizon,
        monthly_investable_override: customInvestable === "" ? null : Number(customInvestable),
        current_emergency_fund: Number(emergencyFund) || 0,
        notes: notes.trim(),
        month: selectedMonth,
      };

      const res = await saveInvestmentProfile(payload);
      setFinancialContext(res.financialContext);
      setRecommendations(res.recommendations);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3500);
    } catch (err) {
      console.error("Failed to save investment profile:", err);
      setError("Failed to save investment profile. Please check your inputs.");
    } finally {
      setSavingProfile(false);
    }
  };

  const getRiskBadgeColor = (level) => {
    switch (level) {
      case "Low":
        return "#16a34a"; // green
      case "Medium":
        return "#2563eb"; // blue
      case "High":
        return "#dc2626"; // red
      default:
        return "#475569";
    }
  };

  const isEmergencyFundBelowTarget =
    financialContext &&
    Number(emergencyFund) < financialContext.emergencyFundRequirement;

  return (
    <div className="investment-container">
      {/* Header & Month Bar */}
      <div className="budget-header-bar">
        <div>
          <h3>Investment Recommendation</h3>
          <p className="subtitle" style={{ margin: 0 }}>
            Suggest suitable investment categories based on income, savings, risk tolerance, goals & horizon
          </p>
        </div>
        <div className="budget-month-selector">
          <label htmlFor="invMonth" style={{ margin: 0, fontWeight: 500 }}>
            Assessment Period:
          </label>
          <input
            id="invMonth"
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
          />
        </div>
      </div>

      {/* Educational Project Disclaimer Banner */}
      <div className="investment-disclaimer-banner">
        <span className="disclaimer-icon">💡</span>
        <div className="disclaimer-content">
          <strong>Academic & Educational Guidance:</strong> The allocations and instruments displayed below are generated via rule-based algorithms to demonstrate personal financial planning concepts for academic project purposes. They do not constitute certified personal financial advice or SEBI-registered investment advisory.
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}
      {saveSuccess && (
        <div className="success-banner" style={{ background: "#dcfce7", color: "#166534", padding: "10px 14px", borderRadius: "6px", marginBottom: "16px", fontWeight: 500 }}>
          ✓ Investment profile and preferences saved successfully!
        </div>
      )}

      {loading ? (
        <p>Analyzing financial capacity and generating investment recommendations...</p>
      ) : (
        <>
          {/* Live Financial Context Overview */}
          {financialContext && (
            <div className="investment-financial-summary">
              <div className="inv-stat-card">
                <span className="inv-stat-label">Monthly Income</span>
                <span className="inv-stat-val text-green">{formatMoney(financialContext.monthlyIncome)}</span>
                <span className="inv-stat-sub">From {financialContext.month} records</span>
              </div>
              <div className="inv-stat-card">
                <span className="inv-stat-label">Total Expenses</span>
                <span className="inv-stat-val text-red">{formatMoney(financialContext.totalExpenses)}</span>
                <span className="inv-stat-sub">Current monthly outflow</span>
              </div>
              <div className="inv-stat-card">
                <span className="inv-stat-label">Net Monthly Savings</span>
                <span className="inv-stat-val" style={{ color: financialContext.rawSavings < 0 ? "var(--danger)" : "var(--primary)" }}>
                  {formatMoney(financialContext.rawSavings)}
                </span>
                <span className="inv-stat-sub">Savings Rate: {financialContext.savingsRatio}%</span>
              </div>
              <div className="inv-stat-card highlight">
                <span className="inv-stat-label">Suggested Monthly Investable</span>
                <span className="inv-stat-val text-primary">
                  {formatMoney(recommendations?.recommendedMonthlyInvest || 0)}
                </span>
                <span className="inv-stat-sub">
                  {customInvestable ? "Custom user override" : "70% of net surplus (30% cash buffer)"}
                </span>
              </div>
            </div>
          )}

          {/* Emergency Fund Readiness Warning if needed */}
          {financialContext && isEmergencyFundBelowTarget && (
            <div className="emergency-fund-warning">
              <span className="warning-icon">⚠️</span>
              <div>
                <strong>Emergency Liquidity Recommendation:</strong>
                <p style={{ margin: "4px 0 0 0", fontSize: "13px" }}>
                  Based on your monthly expense of {formatMoney(financialContext.totalExpenses)}, a safe 3-month emergency cushion is <strong>{formatMoney(financialContext.emergencyFundRequirement)}</strong> (and 6 months is {formatMoney(financialContext.idealEmergencyFund)}). Your current liquid reserve is recorded at {formatMoney(Number(emergencyFund))}. We strongly advise prioritizing Liquid Mutual Funds or High-Yield Savings FDs to build this safety buffer before taking high risks.
                </p>
              </div>
            </div>
          )}

          {/* Profile & Parameter Configuration Form */}
          <div className="investment-card">
            <h4 style={{ margin: "0 0 16px 0", fontSize: "16px", color: "var(--text)" }}>
              ⚙️ Your Investment Profile & Preferences
            </h4>

            <form onSubmit={handleSaveProfile}>
              {/* Risk Tolerance Multi-Choice Selector */}
              <div className="form-group">
                <label style={{ fontSize: "14px", fontWeight: "600", marginBottom: "8px" }}>
                  Risk Tolerance (Select Your Comfort Level):
                </label>
                <div className="risk-selector-grid">
                  <div
                    className={`risk-option-card ${riskTolerance === "Low" ? "selected low" : ""}`}
                    onClick={() => {
                      setRiskTolerance("Low");
                      handleRecalculate("Low", undefined, undefined, undefined, undefined);
                    }}
                  >
                    <div className="risk-card-header">
                      <span className="risk-badge low">🟢 Low Risk</span>
                      <span className="risk-tag">Conservative</span>
                    </div>
                    <p className="risk-card-desc">
                      Focus on 100% capital preservation and stable guaranteed returns. Zero to low market volatility.
                    </p>
                    <div className="risk-card-examples">
                      Instruments: <strong>Fixed Deposits, Debt Funds, PPF</strong>
                    </div>
                  </div>

                  <div
                    className={`risk-option-card ${riskTolerance === "Medium" ? "selected medium" : ""}`}
                    onClick={() => {
                      setRiskTolerance("Medium");
                      handleRecalculate("Medium", undefined, undefined, undefined, undefined);
                    }}
                  >
                    <div className="risk-card-header">
                      <span className="risk-badge medium">🟡 Medium Risk</span>
                      <span className="risk-tag">Balanced</span>
                    </div>
                    <p className="risk-card-desc">
                      Balanced mix of equity and debt to beat inflation with moderate volatility and controlled downside.
                    </p>
                    <div className="risk-card-examples">
                      Instruments: <strong>Balanced/Hybrid Funds, Index Funds</strong>
                    </div>
                  </div>

                  <div
                    className={`risk-option-card ${riskTolerance === "High" ? "selected high" : ""}`}
                    onClick={() => {
                      setRiskTolerance("High");
                      handleRecalculate("High", undefined, undefined, undefined, undefined);
                    }}
                  >
                    <div className="risk-card-header">
                      <span className="risk-badge high">🔴 High Risk</span>
                      <span className="risk-tag">Aggressive</span>
                    </div>
                    <p className="risk-card-desc">
                      Maximize long-term wealth compounding. High tolerance for market swings in pursuit of superior returns.
                    </p>
                    <div className="risk-card-examples">
                      Instruments: <strong>Direct Equity, Flexi-Cap, Mid/Small-Cap Funds</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Goal and Horizon Grid */}
              <div className="inv-form-grid" style={{ marginTop: "16px" }}>
                <div>
                  <label htmlFor="goalSelect">Financial Goal:</label>
                  <select
                    id="goalSelect"
                    value={financialGoal}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFinancialGoal(val);
                      handleRecalculate(undefined, val, undefined, undefined, undefined);
                    }}
                    style={{ width: "100%" }}
                  >
                    <option value="Wealth Creation">🚀 Wealth Creation & Long-Term Growth</option>
                    <option value="Emergency Buffer">🛡️ Emergency Buffer & Capital Safety</option>
                    <option value="Retirement">🏖️ Retirement Planning (FIRE)</option>
                    <option value="Buying a Home">🏠 Buying a Home / Real Estate Downpayment</option>
                    <option value="Higher Education">🎓 Higher Education / Career Skill Up</option>
                    <option value="Short-term Goal">🚗 Short-Term Goal / Vacation / Vehicle</option>
                    <option value="Tax Saving">🧾 Tax Saving (Section 80C Deductions)</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="horizonSelect">Investment Horizon:</label>
                  <select
                    id="horizonSelect"
                    value={investmentHorizon}
                    onChange={(e) => {
                      const val = e.target.value;
                      setInvestmentHorizon(val);
                      handleRecalculate(undefined, undefined, val, undefined, undefined);
                    }}
                    style={{ width: "100%" }}
                  >
                    <option value="Short Term (< 1-3 years)">Short Term (&lt; 1 - 3 years)</option>
                    <option value="Medium Term (3-5 years)">Medium Term (3 - 5 years)</option>
                    <option value="Long Term (5-10 years)">Long Term (5 - 10 years)</option>
                    <option value="Very Long Term (10+ years)">Very Long Term (10+ years)</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="emergencyInput">Current Emergency Liquid Reserve (₹):</label>
                  <input
                    id="emergencyInput"
                    type="number"
                    min="0"
                    placeholder="e.g. 50000"
                    value={emergencyFund}
                    onChange={(e) => {
                      const val = e.target.value;
                      setEmergencyFund(val);
                      handleRecalculate(undefined, undefined, undefined, val, undefined);
                    }}
                    style={{ width: "100%" }}
                  />
                </div>

                <div>
                  <label htmlFor="customSurplusInput">
                    Monthly Investable Amount (₹) <span style={{ fontWeight: 400, color: "var(--text-muted)" }}>(Optional override)</span>:
                  </label>
                  <input
                    id="customSurplusInput"
                    type="number"
                    min="0"
                    placeholder={`Auto-calculated: ${formatMoney(recommendations?.recommendedMonthlyInvest || 0)}`}
                    value={customInvestable}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCustomInvestable(val);
                      handleRecalculate(undefined, undefined, undefined, undefined, val);
                    }}
                    style={{ width: "100%" }}
                  />
                </div>
              </div>

              <div style={{ marginTop: "16px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
                <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>
                  💡 Changes instantly recalculate the model below. Click save to persist preferences.
                </span>
                <button type="submit" disabled={savingProfile} style={{ minWidth: "160px" }}>
                  {savingProfile ? "Saving Profile..." : "💾 Save Profile"}
                </button>
              </div>
            </form>
          </div>

          {/* Asset Allocation Breakdown */}
          {recommendations && (
            <div className="investment-card" style={{ marginTop: "24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", marginBottom: "12px" }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: "16px", color: "var(--text)" }}>
                    📊 Recommended Asset Allocation
                  </h4>
                  <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "var(--text-muted)" }}>
                    Algorithmic distribution matching {riskTolerance} Risk & {financialGoal}
                  </p>
                </div>
                <div className="weighted-return-badge">
                  Target Portfolio Return: <strong>~{recommendations.portfolioWeightedReturn}% p.a.</strong>
                </div>
              </div>

              {/* Multi-segment allocation bar */}
              <div className="allocation-progress-bar">
                {recommendations.assetAllocation.map((item, idx) => (
                  <div
                    key={idx}
                    className="allocation-bar-segment"
                    style={{
                      width: `${item.percentage}%`,
                      backgroundColor: item.color,
                    }}
                    title={`${item.assetClass}: ${item.percentage}% (${formatMoney(item.amount)}/mo)`}
                  />
                ))}
              </div>

              {/* Legend & Details */}
              <div className="allocation-legend-grid">
                {recommendations.assetAllocation.map((item, idx) => (
                  <div key={idx} className="allocation-legend-item">
                    <span className="legend-dot" style={{ backgroundColor: item.color }} />
                    <span className="legend-name">{item.assetClass}</span>
                    <span className="legend-pct">{item.percentage}%</span>
                    <span className="legend-amt">({formatMoney(item.amount)}/mo)</span>
                  </div>
                ))}
              </div>

              {/* Rationale Callout */}
              <div className="recommendation-rationale-box">
                <span className="rationale-icon">🎯</span>
                <div>
                  <strong>Model Rationale:</strong> {recommendations.rationale}
                </div>
              </div>
            </div>
          )}

          {/* Recommended Investment Categories Grid */}
          {recommendations && recommendations.recommendedOptions.length > 0 && (
            <div style={{ marginTop: "24px" }}>
              <div style={{ marginBottom: "16px" }}>
                <h4 style={{ margin: 0, fontSize: "18px", color: "var(--text)" }}>
                  💡 Suggested Investment Options
                </h4>
                <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "var(--text-muted)" }}>
                  Specific categories and products tailored to your monthly investable budget of {formatMoney(recommendations.recommendedMonthlyInvest)}
                </p>
              </div>

              <div className="investment-options-grid">
                {recommendations.recommendedOptions.map((opt) => (
                  <div key={opt.id} className="investment-option-card">
                    <div className="opt-card-top">
                      <div>
                        <span
                          className="opt-risk-pill"
                          style={{
                            color: getRiskBadgeColor(opt.riskLevel),
                            borderColor: getRiskBadgeColor(opt.riskLevel),
                          }}
                        >
                          {opt.riskLevel} Risk
                        </span>
                        <h5 className="opt-title">{opt.name}</h5>
                        <span className="opt-category">{opt.category}</span>
                      </div>
                      <div className="opt-allocation-badge">
                        <span className="opt-alloc-pct">{opt.allocationPct}%</span>
                        <span className="opt-alloc-amt">{formatMoney(opt.monthlyAmount)}/mo</span>
                      </div>
                    </div>

                    <div className="opt-metrics-row">
                      <div className="opt-metric">
                        <span className="metric-label">Expected Return</span>
                        <span className="metric-value text-green">{opt.expectedReturn}</span>
                      </div>
                      <div className="opt-metric">
                        <span className="metric-label">Suggested Horizon</span>
                        <span className="metric-value">{opt.minHorizon}</span>
                      </div>
                    </div>

                    <p className="opt-suitability">
                      <strong>Why this fits:</strong> {opt.suitability}
                    </p>

                    <div className="opt-details-section">
                      <div className="opt-pros">
                        <span className="details-header text-green">✓ Key Advantages</span>
                        <ul>
                          {opt.pros.map((p, i) => (
                            <li key={i}>{p}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="opt-cons">
                        <span className="details-header text-red">⚠️ Important Considerations</span>
                        <ul>
                          {opt.cons.map((c, i) => (
                            <li key={i}>{c}</li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="opt-tax-note">
                      <strong>Tax Status:</strong> {opt.taxStatus}
                    </div>

                    <div className="opt-examples">
                      <strong>Real-world Examples:</strong> {opt.exampleInstruments}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Interactive SIP & Corpus Growth Calculator */}
          <div className="investment-card" style={{ marginTop: "28px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", marginBottom: "16px" }}>
              <div>
                <h4 style={{ margin: 0, fontSize: "17px", color: "var(--text)" }}>
                  📈 Interactive SIP & Corpus Growth Simulator
                </h4>
                <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "var(--text-muted)" }}>
                  Forecast future corpus accumulation through compounding returns
                </p>
              </div>
              <span className="sim-formula-tag">
                Formula: Compound Monthly Annuity SIP
              </span>
            </div>

            <div className="sip-controls-grid">
              <div>
                <label htmlFor="sipAmt">Monthly Investment (₹):</label>
                <input
                  id="sipAmt"
                  type="number"
                  min="500"
                  step="500"
                  value={sipMonthly}
                  onChange={(e) => setSipMonthly(e.target.value)}
                  style={{ width: "100%" }}
                />
              </div>

              <div>
                <label htmlFor="sipRateInput">Expected Return (% p.a.):</label>
                <input
                  id="sipRateInput"
                  type="number"
                  min="1"
                  max="30"
                  step="0.5"
                  value={sipRate}
                  onChange={(e) => setSipRate(e.target.value)}
                  style={{ width: "100%" }}
                />
              </div>

              <div>
                <label htmlFor="sipYearsInput">Time Horizon (Years):</label>
                <input
                  id="sipYearsInput"
                  type="number"
                  min="1"
                  max="35"
                  value={sipYears}
                  onChange={(e) => setSipYears(e.target.value)}
                  style={{ width: "100%" }}
                />
              </div>

              <div>
                <label htmlFor="sipLumpInput">Initial Lump Sum (₹):</label>
                <input
                  id="sipLumpInput"
                  type="number"
                  min="0"
                  step="1000"
                  value={sipLumpSum}
                  onChange={(e) => setSipLumpSum(e.target.value)}
                  style={{ width: "100%" }}
                />
              </div>
            </div>

            {/* Quick Preset Buttons */}
            <div className="sip-presets-bar">
              <span style={{ fontSize: "12px", color: "var(--text-muted)", alignSelf: "center" }}>
                Presets:
              </span>
              <button
                type="button"
                className="sip-preset-btn"
                onClick={() => {
                  setSipYears("3");
                  setSipRate("7.5");
                }}
              >
                Short-Term FD (3 Yrs @ 7.5%)
              </button>
              <button
                type="button"
                className="sip-preset-btn"
                onClick={() => {
                  setSipYears("7");
                  setSipRate("11");
                }}
              >
                Medium Hybrid (7 Yrs @ 11%)
              </button>
              <button
                type="button"
                className="sip-preset-btn"
                onClick={() => {
                  setSipYears("15");
                  setSipRate("13");
                }}
              >
                Long-Term Index (15 Yrs @ 13%)
              </button>
              <button
                type="button"
                className="sip-preset-btn"
                onClick={() => {
                  setSipYears("20");
                  setSipRate("14");
                }}
              >
                Retirement FIRE (20 Yrs @ 14%)
              </button>
            </div>

            {/* Calculation Results Card */}
            {sipResult && (
              <div className="sip-results-panel">
                <div className="sip-result-metric">
                  <span className="metric-title">Total Amount Invested</span>
                  <span className="metric-val">{formatMoney(sipResult.totalInvested)}</span>
                  <span className="metric-sub">
                    {formatMoney(sipMonthly)} × {sipYears * 12} months {Number(sipLumpSum) > 0 ? `+ ₹${Number(sipLumpSum).toLocaleString()} initial` : ""}
                  </span>
                </div>

                <div className="sip-result-metric">
                  <span className="metric-title">Estimated Wealth Gain</span>
                  <span className="metric-val text-green">{formatMoney(sipResult.totalWealthGain)}</span>
                  <span className="metric-sub">Pure Compound Growth</span>
                </div>

                <div className="sip-result-metric highlight">
                  <span className="metric-title">Total Projected Corpus</span>
                  <span className="metric-val text-primary">{formatMoney(sipResult.totalCorpus)}</span>
                  <span className="metric-sub">At End of {sipYears} Years</span>
                </div>
              </div>
            )}

            {/* Visual Ratio Bar */}
            {sipResult && sipResult.totalCorpus > 0 && (
              <div style={{ marginTop: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "6px" }}>
                  <span>
                    Invested Capital: <strong>{formatMoney(sipResult.totalInvested)}</strong> ({Math.round((sipResult.totalInvested / sipResult.totalCorpus) * 100)}%)
                  </span>
                  <span className="text-green">
                    Growth Profit: <strong>{formatMoney(sipResult.totalWealthGain)}</strong> ({Math.round((sipResult.totalWealthGain / sipResult.totalCorpus) * 100)}%)
                  </span>
                </div>
                <div className="allocation-progress-bar" style={{ height: "14px" }}>
                  <div
                    style={{
                      width: `${(sipResult.totalInvested / sipResult.totalCorpus) * 100}%`,
                      backgroundColor: "#64748b",
                    }}
                    title="Invested Capital"
                  />
                  <div
                    style={{
                      width: `${(sipResult.totalWealthGain / sipResult.totalCorpus) * 100}%`,
                      backgroundColor: "#16a34a",
                    }}
                    title="Estimated Growth"
                  />
                </div>
              </div>
            )}

            {/* Milestones Schedule Table */}
            {sipResult && sipResult.milestones && sipResult.milestones.length > 0 && (
              <div style={{ marginTop: "20px" }}>
                <h5 style={{ margin: "0 0 10px 0", fontSize: "14px", color: "var(--text)" }}>
                  ⏳ Wealth Accumulation Milestones Over Time
                </h5>
                <div className="table-responsive">
                  <table className="milestone-table">
                    <thead>
                      <tr>
                        <th>Year</th>
                        <th>Total Invested</th>
                        <th>Interest / Gains</th>
                        <th>Future Corpus Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sipResult.milestones.map((m) => (
                        <tr key={m.year} className={m.year === Number(sipYears) ? "selected-row" : ""}>
                          <td>
                            <strong>Year {m.year}</strong> {m.year === Number(sipYears) && <span className="target-year-pill">Target</span>}
                          </td>
                          <td>{formatMoney(m.invested)}</td>
                          <td className="text-green">+{formatMoney(m.gains)}</td>
                          <td>
                            <strong>{formatMoney(m.totalCorpus)}</strong>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}


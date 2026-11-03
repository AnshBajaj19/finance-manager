const express = require("express");
const mongoose = require("mongoose");
const Income = require("../models/Income");
const Expense = require("../models/Expense");
const InvestmentProfile = require("../models/InvestmentProfile");
const auth = require("../middleware/auth");
const { buildDateFilter } = require("../utils/dateRange");

const router = express.Router();
router.use(auth);

const getCurrentMonthStr = () => new Date().toISOString().slice(0, 7);

/**
 * Helper: Aggregate user's monthly income, expenses, and net savings
 */
async function getUserFinancialContext(userId, targetMonth) {
  const monthStr = targetMonth || getCurrentMonthStr();
  const { filter } = buildDateFilter({ month: monthStr });
  const match = { user_id: new mongoose.Types.ObjectId(userId) };
  if (filter) match.date = filter;

  // 1. Current Month Income
  const incomeAgg = await Income.aggregate([
    { $match: match },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);
  let monthlyIncome = incomeAgg[0]?.total || 0;

  // Fallback to recent month if 0
  if (monthlyIncome === 0) {
    const latestIncome = await Income.find({ user_id: userId })
      .sort({ date: -1 })
      .limit(5);
    if (latestIncome.length > 0) {
      const latestMonthStr = latestIncome[0].date.toISOString().slice(0, 7);
      const { filter: latestFilter } = buildDateFilter({ month: latestMonthStr });
      const recentAgg = await Income.aggregate([
        { $match: { user_id: new mongoose.Types.ObjectId(userId), date: latestFilter } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]);
      monthlyIncome = recentAgg[0]?.total || 0;
    }
  }

  // 2. Current Month Expenses
  const expenseAgg = await Expense.aggregate([
    { $match: match },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);
  let totalExpenses = expenseAgg[0]?.total || 0;

  // Fallback to recent expenses if 0
  if (totalExpenses === 0) {
    const latestExpense = await Expense.find({ user_id: userId })
      .sort({ date: -1 })
      .limit(10);
    if (latestExpense.length > 0) {
      const latestMonthStr = latestExpense[0].date.toISOString().slice(0, 7);
      const { filter: latestFilter } = buildDateFilter({ month: latestMonthStr });
      const recentAgg = await Expense.aggregate([
        { $match: { user_id: new mongoose.Types.ObjectId(userId), date: latestFilter } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]);
      totalExpenses = recentAgg[0]?.total || 0;
    }
  }

  const netSavings = Math.max(0, monthlyIncome - totalExpenses);
  const rawSavings = monthlyIncome - totalExpenses;
  const savingsRatio = monthlyIncome > 0 ? (netSavings / monthlyIncome) * 100 : 0;
  const emergencyFundRequirement = Math.round(totalExpenses * 3); // 3 months benchmark
  const idealEmergencyFund = Math.round(totalExpenses * 6); // 6 months ideal

  return {
    monthlyIncome,
    totalExpenses,
    netSavings,
    rawSavings,
    savingsRatio: Math.round(savingsRatio * 10) / 10,
    emergencyFundRequirement,
    idealEmergencyFund,
    month: monthStr,
  };
}

/**
 * Deterministic Rule-Based Investment Recommendation Engine
 * Based on Risk Tolerance (Low, Medium, High), Financial Goals, Horizon, and Financial Capacity
 */
function generateInvestmentRecommendations({
  riskTolerance = "Medium",
  financialGoal = "Wealth Creation",
  investmentHorizon = "Medium Term (3-5 years)",
  monthlyIncome = 0,
  totalExpenses = 0,
  customInvestable = null,
  currentEmergencyFund = 0,
}) {
  const netSavings = Math.max(0, monthlyIncome - totalExpenses);
  const emergencyRequirement = Math.round(totalExpenses * 3);
  const isEmergencyFundAdequate = (Number(currentEmergencyFund) || 0) >= emergencyRequirement;

  // Determine monthly investable amount:
  // If user provided custom override, respect it.
  // Otherwise, recommend 70% of net savings (leaving 30% liquid cash buffer).
  let recommendedMonthlyInvest = 0;
  if (customInvestable !== null && customInvestable !== undefined && !isNaN(customInvestable) && Number(customInvestable) > 0) {
    recommendedMonthlyInvest = Number(customInvestable);
  } else if (netSavings > 0) {
    recommendedMonthlyInvest = Math.round(netSavings * 0.7);
  } else {
    // If no savings recorded yet, provide a baseline sample for education
    recommendedMonthlyInvest = monthlyIncome > 0 ? Math.round(monthlyIncome * 0.2) : 5000;
  }

  const isShortHorizon = investmentHorizon.includes("Short Term");
  const isLongHorizon = investmentHorizon.includes("Long Term") || investmentHorizon.includes("Very Long Term");

  let assetAllocation = [];
  let recommendedOptions = [];
  let rationale = "";
  let portfolioWeightedReturn = 0;

  // ========================================================
  // 1. LOW RISK (CONSERVATIVE)
  // Capital preservation, low volatility, guaranteed returns
  // ========================================================
  if (riskTolerance === "Low") {
    if (financialGoal === "Tax Saving") {
      assetAllocation = [
        { assetClass: "Debt & Fixed Income", percentage: 70, color: "#16a34a" },
        { assetClass: "Govt Sovereign Schemes", percentage: 30, color: "#0d9488" },
      ];
      recommendedOptions = [
        {
          id: "ppf",
          name: "Public Provident Fund (PPF)",
          category: "Government Savings",
          riskLevel: "Low",
          allocationPct: 50,
          expectedReturn: "7.1% p.a. (Tax-Free)",
          returnNumeric: 7.1,
          minHorizon: "15 Years (Partial withdrawals after 6 yrs)",
          taxStatus: "EEE Status (Exempt on Investment, Interest & Maturity under Sec 80C)",
          suitability: "Completely risk-free sovereign guarantee backed by the Government of India, ideal for zero-risk tax saving.",
          pros: [
            "Backed by Govt of India with 100% sovereign safety",
            "Triple tax-exempt (EEE) status up to ₹1.5L per year",
            "Compounded annually with guaranteed declared returns",
          ],
          cons: [
            "15-year lock-in period with structured withdrawal limits",
            "Maximum annual deposit capped at ₹1,50,000",
          ],
          exampleInstruments: "Available via Post Office, SBI, HDFC, ICICI, PNB",
        },
        {
          id: "tax_saver_fd",
          name: "5-Year Tax Saver Fixed Deposit",
          category: "Bank Fixed Income",
          riskLevel: "Low",
          allocationPct: 30,
          expectedReturn: "6.5% - 7.2% p.a.",
          returnNumeric: 6.8,
          minHorizon: "5 Years mandatory lock-in",
          taxStatus: "Deduction under Section 80C (Interest taxed as per income slab)",
          suitability: "Predictable, guaranteed return deposit for conservative individuals seeking 80C deduction.",
          pros: [
            "Guaranteed fixed interest locked for 5 years",
            "DICGC insured up to ₹5,00,000 per bank",
            "Hassle-free setup via internet banking",
          ],
          cons: [
            "Strict 5-year lock-in with zero premature withdrawal",
            "Interest income is taxable as per income tax slab",
          ],
          exampleInstruments: "SBI Tax Saver FD, HDFC 5-Year Tax Saver, ICICI Bank",
        },
        {
          id: "liquid_fund",
          name: "Liquid Mutual Funds / High-Yield Savings",
          category: "Liquid Debt",
          riskLevel: "Low",
          allocationPct: 20,
          expectedReturn: "6.2% - 6.8% p.a.",
          returnNumeric: 6.5,
          minHorizon: "Anytime (T+1 liquidity)",
          taxStatus: "Taxed as per income tax slab",
          suitability: "Maintains liquid reserve while earning higher yields than regular savings accounts.",
          pros: [
            "High liquidity with 1-day redemptions",
            "Invests only in ultra-short treasury bills & AAA bonds",
            "No lock-in penalty after 7 days",
          ],
          cons: [
            "Slight interest rate yield fluctuation",
            "Not capital-guaranteed like bank deposits",
          ],
          exampleInstruments: "SBI Liquid Fund, Aditya Birla Sun Life Liquid, HDFC Liquid",
        },
      ];
      rationale = "Your portfolio prioritizes Section 80C tax deductions and 100% capital preservation through PPF and 5-Year Bank Tax Saver FDs.";
    } else if (isShortHorizon || financialGoal === "Emergency Buffer" || financialGoal === "Short-term Goal") {
      assetAllocation = [
        { assetClass: "Fixed Deposits (FD / RD)", percentage: 50, color: "#16a34a" },
        { assetClass: "Liquid & Debt Mutual Funds", percentage: 35, color: "#059669" },
        { assetClass: "Sovereign / Post Schemes", percentage: 15, color: "#0d9488" },
      ];
      recommendedOptions = [
        {
          id: "fd",
          name: "Fixed Deposits (FD) & Recurring Deposits (RD)",
          category: "Bank Fixed Income",
          riskLevel: "Low",
          allocationPct: 50,
          expectedReturn: "6.5% - 7.5% p.a.",
          returnNumeric: 7.0,
          minHorizon: "6 Months - 3 Years",
          taxStatus: "TDS applicable if interest exceeds ₹40,000/year (₹50,000 for seniors)",
          suitability: "Absolute capital safety and fixed guaranteed payout for your short-term horizon.",
          pros: [
            "Zero market volatility risk; guaranteed interest rate",
            "Insured up to ₹5 Lakh by DICGC per bank",
            "Flexible tenures from 7 days to 10 years",
          ],
          cons: [
            "Returns may trail inflation over prolonged periods",
            "Interest is taxable at your marginal tax rate",
          ],
          exampleInstruments: "HDFC Bank FD, State Bank of India Term Deposit, ICICI Bank FD",
        },
        {
          id: "debt_fund",
          name: "Short-Duration Debt Mutual Funds",
          category: "Debt Funds",
          riskLevel: "Low",
          allocationPct: 35,
          expectedReturn: "6.5% - 7.2% p.a.",
          returnNumeric: 6.8,
          minHorizon: "1 - 3 Years",
          taxStatus: "Taxed at marginal income slab rate",
          suitability: "Professional debt portfolio investing in high-rated corporate and sovereign paper with better liquidity.",
          pros: [
            "Better liquidity than bank FDs with no fixed commitment",
            "High safety through AAA/Sovereign credit ratings",
            "Ideal holding period of 1 to 3 years",
          ],
          cons: [
            "Subject to minor interest rate sensitivity",
            "Indexation benefit no longer available for debt funds",
          ],
          exampleInstruments: "HDFC Short Term Debt Fund, ICICI Prudential Short Term Fund",
        },
        {
          id: "ppf",
          name: "Public Provident Fund (PPF)",
          category: "Government Savings",
          riskLevel: "Low",
          allocationPct: 15,
          expectedReturn: "7.1% p.a. (Tax-Free)",
          returnNumeric: 7.1,
          minHorizon: "Long-term safe wealth baseline",
          taxStatus: "EEE Status (Exempt-Exempt-Exempt)",
          suitability: "Builds a long-term sovereign-backed safe corpus alongside short-term reserves.",
          pros: [
            "Guaranteed by the Government of India",
            "Completely tax-free interest and maturity corpus",
            "Compounds annually",
          ],
          cons: [
            "15-year tenure with structured annual limit of ₹1.5L",
          ],
          exampleInstruments: "Post Office, SBI, Canara Bank, HDFC Bank PPF accounts",
        },
      ];
      rationale = "Given your conservative profile and short time horizon, capital safety and liquidity are paramount. Your allocation is concentrated in insured Bank FDs and high-grade Debt Funds.";
    } else {
      // Low Risk + Medium/Long Horizon
      assetAllocation = [
        { assetClass: "Public Provident Fund (PPF)", percentage: 40, color: "#0d9488" },
        { assetClass: "Fixed Deposits / Corp FDs", percentage: 35, color: "#16a34a" },
        { assetClass: "Debt Mutual Funds", percentage: 15, color: "#059669" },
        { assetClass: "Sovereign Gold Bonds (SGB)", percentage: 10, color: "#f59e0b" },
      ];
      recommendedOptions = [
        {
          id: "ppf",
          name: "Public Provident Fund (PPF)",
          category: "Government Savings",
          riskLevel: "Low",
          allocationPct: 40,
          expectedReturn: "7.1% p.a. (Tax-Free)",
          returnNumeric: 7.1,
          minHorizon: "15 Years",
          taxStatus: "Triple Tax-Exempt (EEE under Sec 80C)",
          suitability: "Your core long-term risk-free compounding engine with 100% sovereign safety.",
          pros: [
            "Sovereign guarantee by Govt of India",
            "Completely tax-free compound interest",
            "Loan and partial withdrawal facilities after initial years",
          ],
          cons: ["15-year tenure; deposit ceiling of ₹1.5 Lakh/year"],
          exampleInstruments: "SBI, Post Office, Bank of Baroda PPF",
        },
        {
          id: "fd",
          name: "Fixed Deposits & Corporate AAA Deposits",
          category: "Bank & Corporate Fixed Income",
          riskLevel: "Low",
          allocationPct: 35,
          expectedReturn: "7.0% - 7.8% p.a.",
          returnNumeric: 7.4,
          minHorizon: "3 - 5 Years",
          taxStatus: "Taxed at marginal slab rate",
          suitability: "Steady cash flows and guaranteed capital preservation.",
          pros: [
            "Assured yield locked in against falling interest rates",
            "DICGC insurance on bank deposits",
          ],
          cons: ["Tax drag on interest earnings"],
          exampleInstruments: "Bajaj Finance AAA Deposit, HDFC Bank FD, ICICI Bank FD",
        },
        {
          id: "debt_fund",
          name: "Banking & PSU Debt Mutual Funds",
          category: "Debt Funds",
          riskLevel: "Low",
          allocationPct: 15,
          expectedReturn: "6.8% - 7.5% p.a.",
          returnNumeric: 7.1,
          minHorizon: "3+ Years",
          taxStatus: "Taxed as per slab rate",
          suitability: "Lends exclusively to public sector banks and top-tier corporations.",
          pros: [
            "Exceptional credit quality with minimal default risk",
            "Better operational flexibility than traditional FDs",
          ],
          cons: ["Returns fluctuate with macro RBI repo rates"],
          exampleInstruments: "IDFC / Bandhan Banking & PSU Debt, SBI Banking & PSU",
        },
        {
          id: "sgb",
          name: "Sovereign Gold Bonds (SGB) / Gold ETF",
          category: "Commodity Hedge",
          riskLevel: "Low",
          allocationPct: 10,
          expectedReturn: "2.5% fixed + Gold price growth",
          returnNumeric: 9.5,
          minHorizon: "5 - 8 Years",
          taxStatus: "Capital gains 100% tax-free if held until RBI maturity",
          suitability: "Natural hedge against inflation and currency depreciation without making storage compromises.",
          pros: [
            "Earns 2.5% p.a. guaranteed interest paid semi-annually",
            "Complete exemption from capital gains tax at maturity",
            "Zero purity or making charges unlike physical jewelry",
          ],
          cons: ["8-year maturity tenor (tradable on stock exchange with liquidity spread)"],
          exampleInstruments: "RBI Sovereign Gold Bond tranches, Nippon India Gold ETF",
        },
      ];
      rationale = "Structured for steady long-term capital preservation with tax-free PPF compounding and a 10% Gold hedge against inflation.";
    }
  }

  // ========================================================
  // 2. MEDIUM RISK (BALANCED / MODERATE)
  // Balanced growth, controlled volatility, debt-equity mix
  // ========================================================
  else if (riskTolerance === "Medium") {
    if (financialGoal === "Tax Saving") {
      assetAllocation = [
        { assetClass: "Equity (ELSS Mutual Funds)", percentage: 60, color: "#2563eb" },
        { assetClass: "Debt (PPF / Fixed Income)", percentage: 40, color: "#16a34a" },
      ];
      recommendedOptions = [
        {
          id: "elss",
          name: "ELSS Tax Saver Equity Funds",
          category: "Equity Tax Saving",
          riskLevel: "Medium",
          allocationPct: 60,
          expectedReturn: "12% - 14% p.a.",
          returnNumeric: 13.0,
          minHorizon: "3 Years mandatory lock-in",
          taxStatus: "Section 80C deduction up to ₹1.5L; LTCG 12.5% above ₹1.25L",
          suitability: "Shortest lock-in among all 80C options with wealth compounding through diversified equities.",
          pros: [
            "Lowest lock-in of only 3 years compared to 5-yr FD or 15-yr PPF",
            "Historical long-term returns significantly outpace inflation",
            "Professional fund management across top Indian companies",
          ],
          cons: [
            "Equity market volatility during market drawdowns",
            "Cannot withdraw capital before 3 years",
          ],
          exampleInstruments: "Mirae Asset ELSS Tax Saver, Quant ELSS Tax Saver, Parag Parikh ELSS",
        },
        {
          id: "ppf",
          name: "Public Provident Fund (PPF)",
          category: "Government Savings",
          riskLevel: "Low",
          allocationPct: 40,
          expectedReturn: "7.1% p.a. (Tax-Free)",
          returnNumeric: 7.1,
          minHorizon: "15 Years",
          taxStatus: "Exempt-Exempt-Exempt (EEE) under Sec 80C",
          suitability: "Supplies guaranteed debt stability to balance out the market volatility of ELSS.",
          pros: [
            "100% sovereign safety",
            "Zero tax on interest or maturity",
          ],
          cons: ["Lengthy lock-in period"],
          exampleInstruments: "State Bank of India, Post Office, HDFC PPF",
        },
      ];
      rationale = "A proven 60/40 balanced tax-saving structure: ELSS delivers aggressive inflation-beating equity growth while PPF shields your core capital.";
    } else if (isShortHorizon) {
      assetAllocation = [
        { assetClass: "Balanced Advantage / Dynamic Hybrid", percentage: 45, color: "#8b5cf6" },
        { assetClass: "Debt / Fixed Deposits", percentage: 40, color: "#16a34a" },
        { assetClass: "Large-Cap Index Funds", percentage: 15, color: "#2563eb" },
      ];
      recommendedOptions = [
        {
          id: "hybrid_funds",
          name: "Balanced Advantage / Dynamic Asset Allocation Funds",
          category: "Hybrid Funds",
          riskLevel: "Medium",
          allocationPct: 45,
          expectedReturn: "9.5% - 11.5% p.a.",
          returnNumeric: 10.5,
          minHorizon: "2 - 3 Years",
          taxStatus: "Equity taxation rules apply (LTCG 12.5% above ₹1.25L)",
          suitability: "Automatically shifts between debt and equity based on market valuation, smoothing out downturns.",
          pros: [
            "Automatic 'buy low, sell high' dynamic asset rebalancing",
            "Significantly lower downside drawdown than pure equity",
            "Retains favorable equity tax status",
          ],
          cons: [
            "May lag pure equity during sharp runaway bull runs",
            "Expense ratios slightly higher than passive index funds",
          ],
          exampleInstruments: "ICICI Prudential Balanced Advantage, Edelweiss Balanced Advantage",
        },
        {
          id: "debt_fund",
          name: "Short-Duration Debt & Corporate Bond Funds",
          category: "Debt Funds",
          riskLevel: "Low",
          allocationPct: 40,
          expectedReturn: "6.8% - 7.5% p.a.",
          returnNumeric: 7.1,
          minHorizon: "1 - 3 Years",
          taxStatus: "Taxed at applicable income tax slab",
          suitability: "Provides liquid foundation to protect your short-term horizon.",
          pros: ["High safety from top-rated AAA corporate debt", "Steady interest accrual"],
          cons: ["Taxed as per slab rate"],
          exampleInstruments: "HDFC Short Term Fund, ICICI Prudential Corporate Bond Fund",
        },
        {
          id: "index_funds",
          name: "Nifty 50 Large-Cap Index Funds",
          category: "Index Funds",
          riskLevel: "Medium",
          allocationPct: 15,
          expectedReturn: "11.0% - 12.5% p.a.",
          returnNumeric: 11.8,
          minHorizon: "3+ Years",
          taxStatus: "LTCG 12.5% on profits exceeding ₹1.25 Lakh/year",
          suitability: "Low-cost participation in India's top 50 bluechip companies.",
          pros: ["Extremely low expense ratios (<0.15%)", "Zero fund manager bias or stock-picking risk"],
          cons: ["Subject to short-term market corrections"],
          exampleInstruments: "UTI Nifty 50 Index Fund, Navi Nifty 50 Index Fund",
        },
      ];
      rationale = "Because your timeline is relatively short (under 3 years), the portfolio deploys Dynamic Hybrid and high-grade Debt funds to minimize drawdowns while maintaining an index equity kicker.";
    } else {
      // Medium Risk + Medium/Long Horizon (Standard Balanced Allocation)
      assetAllocation = [
        { assetClass: "Index & Large-Cap Equity", percentage: 40, color: "#2563eb" },
        { assetClass: "Balanced Hybrid Funds", percentage: 35, color: "#8b5cf6" },
        { assetClass: "Debt Funds & Fixed Income", percentage: 15, color: "#16a34a" },
        { assetClass: "Gold / Multi-Asset Hedge", percentage: 10, color: "#f59e0b" },
      ];
      recommendedOptions = [
        {
          id: "index_funds",
          name: "Index Funds (Nifty 50 & Nifty Next 50)",
          category: "Index Funds",
          riskLevel: "Medium",
          allocationPct: 40,
          expectedReturn: "11.5% - 13.0% p.a.",
          returnNumeric: 12.3,
          minHorizon: "5+ Years",
          taxStatus: "LTCG 12.5% on capital gains above ₹1.25L; STCG 20%",
          suitability: "Direct low-cost ownership of India's biggest market leaders across finance, IT, FMCG, and energy.",
          pros: [
            "Ultra-low expense ratio (0.05% - 0.20%) maximizes your net return",
            "Eliminates fund manager underperformance risk",
            "Tracks the core growth of the Indian economy",
          ],
          cons: [
            "Full exposure to broad market drawdowns during bear phases",
          ],
          exampleInstruments: "UTI Nifty 50 Index Fund, HDFC Nifty 50 Index, ICICI Nifty 50",
        },
        {
          id: "hybrid_funds",
          name: "Aggressive / Balanced Hybrid Mutual Funds",
          category: "Hybrid Funds",
          riskLevel: "Medium",
          allocationPct: 35,
          expectedReturn: "10.5% - 12.0% p.a.",
          returnNumeric: 11.2,
          minHorizon: "3 - 5 Years",
          taxStatus: "Equity taxation (LTCG 12.5% above ₹1.25L)",
          suitability: "Maintains 65-80% in equities for growth and 20-35% in debt securities to cushion volatility.",
          pros: [
            "Automatic regular portfolio rebalancing between equity and debt",
            "Smoother ride with noticeably lower volatility than pure equity",
            "Consistent track record over complete market cycles",
          ],
          cons: [
            "Slightly higher total expense ratio than passive index funds",
          ],
          exampleInstruments: "Mirae Asset Aggressive Hybrid, Canara Robeco Equity Hybrid, SBI Equity Hybrid",
        },
        {
          id: "debt_funds",
          name: "Corporate Bond Funds / PPF",
          category: "Debt & Fixed Income",
          riskLevel: "Low",
          allocationPct: 15,
          expectedReturn: "7.0% - 7.5% p.a.",
          returnNumeric: 7.2,
          minHorizon: "3+ Years",
          taxStatus: "Taxed at applicable income slab",
          suitability: "Provides predictable interest income and portfolio stabilization.",
          pros: [
            "Safe AAA corporate paper ensures high capital security",
            "Reduces overall portfolio standard deviation",
          ],
          cons: ["Lower returns relative to equities"],
          exampleInstruments: "HDFC Corporate Bond Fund, Aditya Birla Corporate Bond, PPF",
        },
        {
          id: "gold",
          name: "Sovereign Gold Bonds (SGB) / Gold ETFs",
          category: "Commodity Hedge",
          riskLevel: "Low",
          allocationPct: 10,
          expectedReturn: "2.5% coupon + Gold appreciation",
          returnNumeric: 9.5,
          minHorizon: "5 - 8 Years",
          taxStatus: "100% Tax-free capital gains if held to RBI maturity",
          suitability: "Acts as a protective financial hedge when stock markets experience turbulence.",
          pros: [
            "Additional 2.5% annual interest credited directly to your bank",
            "No storage fees, locker charges, or making fee loss",
          ],
          cons: ["Price moves depend on global bullion markets"],
          exampleInstruments: "RBI Sovereign Gold Bonds, Nippon India Gold ETF",
        },
      ];
      rationale = "A diversified 75% equity/hybrid and 25% debt/gold allocation designed for optimal risk-adjusted returns, outperforming inflation while keeping drawdowns manageable.";
    }
  }

  // ========================================================
  // 3. HIGH RISK (AGGRESSIVE / GROWTH)
  // Maximum long-term wealth compounding, higher equity exposure
  // ========================================================
  else {
    if (financialGoal === "Tax Saving") {
      assetAllocation = [
        { assetClass: "ELSS Tax Saver Equity Funds", percentage: 80, color: "#2563eb" },
        { assetClass: "PPF / Sovereign Debt", percentage: 20, color: "#16a34a" },
      ];
      recommendedOptions = [
        {
          id: "elss",
          name: "ELSS Tax Saver Equity Mutual Funds",
          category: "Equity Tax Saving",
          riskLevel: "High",
          allocationPct: 80,
          expectedReturn: "13% - 15.5% p.a.",
          returnNumeric: 14.2,
          minHorizon: "3 - 5+ Years",
          taxStatus: "Sec 80C deduction up to ₹1.5L; LTCG 12.5% above ₹1.25L",
          suitability: "Aggressive wealth compounding combined with annual tax relief under Section 80C.",
          pros: [
            "High growth potential across multi-cap equities",
            "Shortest lock-in (3 years) among all tax-saving instruments",
            "Compounding wealth over long timeframes",
          ],
          cons: [
            "Equity market fluctuations can cause interim paper drawdowns",
            "Capital locked for 3 years",
          ],
          exampleInstruments: "Parag Parikh ELSS Tax Saver, Quant ELSS Tax Saver, Mirae Asset ELSS",
        },
        {
          id: "ppf",
          name: "Public Provident Fund (PPF)",
          category: "Government Savings",
          riskLevel: "Low",
          allocationPct: 20,
          expectedReturn: "7.1% p.a. (Tax-Free)",
          returnNumeric: 7.1,
          minHorizon: "15 Years",
          taxStatus: "EEE Status (Exempt-Exempt-Exempt)",
          suitability: "Risk-free sovereign backing providing an anchor for your tax-saving portfolio.",
          pros: ["100% sovereign guarantee", "Tax-free interest"],
          cons: ["15-year commitment"],
          exampleInstruments: "SBI, Post Office, HDFC PPF",
        },
      ];
      rationale = "An aggressive 80/20 growth-first tax saving portfolio designed to capture maximum equity compounding while satisfying Section 80C exemptions.";
    } else if (isShortHorizon) {
      // Prudent safety override: High risk with short horizon requires dynamic equity to prevent principal erosion
      assetAllocation = [
        { assetClass: "Dynamic Asset Allocation / Balanced Advantage", percentage: 50, color: "#8b5cf6" },
        { assetClass: "Nifty 50 Index Funds", percentage: 30, color: "#2563eb" },
        { assetClass: "Arbitrage & Ultra Short Debt", percentage: 20, color: "#16a34a" },
      ];
      recommendedOptions = [
        {
          id: "hybrid_funds",
          name: "Dynamic Asset Allocation / Balanced Advantage Funds",
          category: "Hybrid Funds",
          riskLevel: "Medium",
          allocationPct: 50,
          expectedReturn: "9.5% - 11.5% p.a.",
          returnNumeric: 10.5,
          minHorizon: "2 - 3 Years",
          taxStatus: "Equity taxation (LTCG 12.5% above ₹1.25L)",
          suitability: "Protects short-term capital by automatically paring equity exposure when markets become overvalued.",
          pros: ["Dynamic valuation-based asset shifting", "Reduced downside risk"],
          cons: ["May cap upside during euphoric rallies"],
          exampleInstruments: "ICICI Prudential Balanced Advantage, Kotak Balanced Advantage",
        },
        {
          id: "index_funds",
          name: "Nifty 50 Index Funds",
          category: "Index Funds",
          riskLevel: "Medium",
          allocationPct: 30,
          expectedReturn: "11.0% - 12.5% p.a.",
          returnNumeric: 11.8,
          minHorizon: "3+ Years",
          taxStatus: "LTCG 12.5% above ₹1.25L",
          suitability: "Low-cost exposure to top 50 bluechip companies.",
          pros: ["Ultra-low expense ratio", "Zero manager risk"],
          cons: ["Interim market volatility"],
          exampleInstruments: "UTI Nifty 50 Index Fund, HDFC Index Fund",
        },
        {
          id: "arbitrage",
          name: "Arbitrage Funds / Ultra-Short Term Debt",
          category: "Arbitrage & Debt",
          riskLevel: "Low",
          allocationPct: 20,
          expectedReturn: "6.8% - 7.5% p.a.",
          returnNumeric: 7.1,
          minHorizon: "6 Months - 2 Years",
          taxStatus: "Equity tax treatment (LTCG 12.5% above ₹1.25L)",
          suitability: "Exploits cash-futures mispricing for virtually risk-free debt-like returns with equity tax efficiency.",
          pros: ["Negligible equity risk", "Better post-tax yield than bank FDs for higher tax brackets"],
          cons: ["Yield depends on market derivative spreads"],
          exampleInstruments: "Kotak Equity Arbitrage Fund, SBI Arbitrage Opportunities Fund",
        },
      ];
      rationale = "Prudent risk adjustment: Even for aggressive investors, an investment horizon under 3 years requires capital defense via Balanced Advantage and Arbitrage funds to safeguard against market downturns.";
    } else {
      // High Risk + Medium/Long Horizon (Full Wealth Compounding)
      assetAllocation = [
        { assetClass: "Broad Market Index Funds", percentage: 35, color: "#2563eb" },
        { assetClass: "Flexi-Cap & Mid-Cap Funds", percentage: 35, color: "#3b82f6" },
        { assetClass: "Small-Cap / Thematic Growth", percentage: 15, color: "#6366f1" },
        { assetClass: "Multi-Asset & Gold Cushion", percentage: 15, color: "#f59e0b" },
      ];
      recommendedOptions = [
        {
          id: "index_funds",
          name: "Broad Market Index Funds (Nifty 50 / Sensex)",
          category: "Index Funds",
          riskLevel: "Medium",
          allocationPct: 35,
          expectedReturn: "12% - 13.5% p.a.",
          returnNumeric: 12.8,
          minHorizon: "5+ Years",
          taxStatus: "LTCG 12.5% on gains exceeding ₹1.25 Lakh; STCG 20%",
          suitability: "The foundational core of your portfolio, capturing the long-term gross output of India's biggest corporations.",
          pros: [
            "Ultra-low expense ratio (0.05% - 0.15%) keeping your compounding leak-free",
            "Direct ownership in top 50 corporate engines of India",
            "Historically outperforms 75%+ of actively managed large-cap funds over 10+ years",
          ],
          cons: [
            "Subject to periodic market volatility and drawdowns during economic cycles",
          ],
          exampleInstruments: "UTI Nifty 50 Index Fund, HDFC Index Nifty 50, Navi Nifty 50",
        },
        {
          id: "flexicap_funds",
          name: "Flexi-Cap & Mid-Cap Mutual Funds",
          category: "Active Equity Funds",
          riskLevel: "High",
          allocationPct: 35,
          expectedReturn: "13.5% - 16% p.a.",
          returnNumeric: 14.5,
          minHorizon: "5 - 7+ Years",
          taxStatus: "LTCG 12.5% above ₹1.25L; STCG 20%",
          suitability: "Dynamic cross-cap freedom allowing top fund managers to hunt high-growth emerging companies.",
          pros: [
            "Freedom to invest across Large, Mid, and Small caps without mandate restrictions",
            "High upside potential from fast-growing Indian mid-size enterprises",
            "Demonstrated alpha over broad indices across full economic cycles",
          ],
          cons: [
            "Higher volatility and standard deviation than pure index funds",
            "Higher fund manager reliance and management fees (0.6% - 1.2%)",
          ],
          exampleInstruments: "Parag Parikh Flexi Cap Fund, HDFC Flexi Cap, Motilal Oswal Midcap Fund",
        },
        {
          id: "smallcap_funds",
          name: "Small-Cap & Thematic Growth Funds",
          category: "High-Alpha Equity",
          riskLevel: "High",
          allocationPct: 15,
          expectedReturn: "15% - 18% p.a.",
          returnNumeric: 16.0,
          minHorizon: "7 - 10+ Years",
          taxStatus: "LTCG 12.5% above ₹1.25L; STCG 20%",
          suitability: "Turbocharges long-term corpus growth by investing in high-potential small enterprises at early scale.",
          pros: [
            "Highest historical compound growth rates over 7-10+ year time horizons",
            "Participation in future sector leaders and multi-bagger growth stories",
          ],
          cons: [
            "Sharp short-term drawdowns of 20-35% can occur during market corrections",
            "Requires patience and strong psychological holding conviction",
          ],
          exampleInstruments: "Nippon India Small Cap Fund, Tata Small Cap Fund, Quant Small Cap",
        },
        {
          id: "dynamic_gold_hedge",
          name: "Multi-Asset Funds & Sovereign Gold (SGB)",
          category: "Diversification Hedge",
          riskLevel: "Medium",
          allocationPct: 15,
          expectedReturn: "9% - 11% p.a.",
          returnNumeric: 10.0,
          minHorizon: "5+ Years",
          taxStatus: "SGB tax-free at RBI maturity; Multi-asset as per fund category",
          suitability: "Provides liquidity and portfolio shock-absorption for systematic rebalancing during market dips.",
          pros: [
            "Protective anchor that rises when equities undergo temporary corrections",
            "Allows rebalancing dry powder without liquidating equity holdings at a loss",
          ],
          cons: ["Moderates peak portfolio gains during one-way bull markets"],
          exampleInstruments: "ICICI Prudential Multi-Asset Fund, Sovereign Gold Bonds (SGB)",
        },
      ];
      rationale = "High-octane wealth compounding portfolio allocating 85% to broad index, flexi-cap, and small-cap equities for long-term multi-fold expansion, stabilized by a 15% gold/multi-asset rebalancing hedge.";
    }
  }

  // Calculate allocated monthly amounts for each recommended option
  let allocatedTotal = 0;
  for (let i = 0; i < recommendedOptions.length; i++) {
    const opt = recommendedOptions[i];
    opt.monthlyAmount = Math.round((recommendedMonthlyInvest * opt.allocationPct) / 100);
    allocatedTotal += opt.monthlyAmount;
    portfolioWeightedReturn += (opt.returnNumeric * opt.allocationPct) / 100;
  }
  portfolioWeightedReturn = Math.round(portfolioWeightedReturn * 10) / 10;

  // Asset allocation amounts
  for (const asset of assetAllocation) {
    asset.amount = Math.round((recommendedMonthlyInvest * asset.percentage) / 100);
  }

  return {
    riskTolerance,
    financialGoal,
    investmentHorizon,
    monthlyIncome,
    totalExpenses,
    netSavings,
    recommendedMonthlyInvest,
    isEmergencyFundAdequate,
    currentEmergencyFund: Number(currentEmergencyFund) || 0,
    emergencyRequirement,
    idealEmergencyFund: totalExpenses * 6,
    portfolioWeightedReturn,
    assetAllocation,
    recommendedOptions,
    rationale,
    educationalDisclaimer:
      "Educational Project Disclaimer: The investment categories and allocations suggested above are generated via deterministic rule-based algorithms for college academic and educational demonstration purposes only. They do not constitute certified personal financial advice or SEBI-registered investment advisory. Real-world financial investments are subject to market risks.",
  };
}

/**
 * Helper: Compound Interest SIP & Lump Sum Wealth Projection Calculator
 * A = P * ((1 + i)^n - 1) / i * (1 + i)
 */
function calculateSipCorpus({
  monthlyInvestment = 5000,
  expectedReturnAnnual = 12,
  years = 10,
  initialLumpSum = 0,
}) {
  const P = Number(monthlyInvestment) || 0;
  const r = Number(expectedReturnAnnual) || 0;
  const t = Number(years) || 1;
  const L = Number(initialLumpSum) || 0;

  const monthlyRate = r / (12 * 100);
  const totalMonths = t * 12;

  let futureSipCorpus = 0;
  if (monthlyRate > 0) {
    futureSipCorpus =
      P * (((Math.pow(1 + monthlyRate, totalMonths) - 1) / monthlyRate) * (1 + monthlyRate));
  } else {
    futureSipCorpus = P * totalMonths;
  }

  // Future value of lump sum
  const futureLumpSum = L * Math.pow(1 + r / 100, t);
  const totalCorpus = Math.round(futureSipCorpus + futureLumpSum);
  const totalInvested = Math.round(P * totalMonths + L);
  const totalWealthGain = Math.max(0, totalCorpus - totalInvested);

  // Generate milestone projections
  const milestonesYears = [1, 2, 3, 5, 10, 15, 20, 25].filter((yr) => yr <= Math.max(t, 25));
  if (!milestonesYears.includes(t)) {
    milestonesYears.push(t);
    milestonesYears.sort((a, b) => a - b);
  }

  const milestones = milestonesYears.map((yr) => {
    const months = yr * 12;
    let sipVal = 0;
    if (monthlyRate > 0) {
      sipVal = P * (((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate) * (1 + monthlyRate));
    } else {
      sipVal = P * months;
    }
    const lumpVal = L * Math.pow(1 + r / 100, yr);
    const corpus = Math.round(sipVal + lumpVal);
    const invested = Math.round(P * months + L);
    const gains = Math.max(0, corpus - invested);
    return {
      year: yr,
      invested,
      gains,
      totalCorpus: corpus,
    };
  });

  return {
    monthlyInvestment: P,
    expectedReturnAnnual: r,
    years: t,
    initialLumpSum: L,
    totalInvested,
    totalWealthGain,
    totalCorpus,
    milestones,
  };
}

// ========================================================
// API ROUTES
// ========================================================

/**
 * GET /api/investment/profile
 * Retrieves user's investment profile and calculates real-time recommendations
 */
router.get("/profile", async (req, res) => {
  try {
    const month = req.query.month || getCurrentMonthStr();
    const financialContext = await getUserFinancialContext(req.userId, month);

    let profile = await InvestmentProfile.findOne({ user_id: req.userId });

    if (!profile) {
      // Create sensible defaults
      profile = new InvestmentProfile({
        user_id: req.userId,
        risk_tolerance: "Medium",
        financial_goal: "Wealth Creation",
        investment_horizon: "Medium Term (3-5 years)",
        monthly_investable_override: null,
        current_emergency_fund: 0,
        target_corpus: 1000000,
        notes: "",
      });
      await profile.save();
    }

    const recommendations = generateInvestmentRecommendations({
      riskTolerance: profile.risk_tolerance,
      financialGoal: profile.financial_goal,
      investmentHorizon: profile.investment_horizon,
      monthlyIncome: financialContext.monthlyIncome,
      totalExpenses: financialContext.totalExpenses,
      customInvestable: profile.monthly_investable_override,
      currentEmergencyFund: profile.current_emergency_fund,
    });

    res.json({
      profile,
      financialContext,
      recommendations,
    });
  } catch (err) {
    console.error("Error fetching investment profile:", err);
    res.status(500).json({ message: "Failed to fetch investment profile." });
  }
});

/**
 * POST /api/investment/profile
 * Updates user's investment profile and returns fresh recommendations
 */
router.post("/profile", async (req, res) => {
  try {
    const {
      risk_tolerance,
      financial_goal,
      investment_horizon,
      monthly_investable_override,
      current_emergency_fund,
      target_corpus,
      notes,
      month,
    } = req.body;

    const updateFields = {};
    if (risk_tolerance) updateFields.risk_tolerance = risk_tolerance;
    if (financial_goal) updateFields.financial_goal = financial_goal;
    if (investment_horizon) updateFields.investment_horizon = investment_horizon;
    if (monthly_investable_override !== undefined) {
      updateFields.monthly_investable_override =
        monthly_investable_override === "" || monthly_investable_override === null
          ? null
          : Number(monthly_investable_override);
    }
    if (current_emergency_fund !== undefined) {
      updateFields.current_emergency_fund = Number(current_emergency_fund) || 0;
    }
    if (target_corpus !== undefined) {
      updateFields.target_corpus = Number(target_corpus) || 0;
    }
    if (notes !== undefined) updateFields.notes = notes;

    const profile = await InvestmentProfile.findOneAndUpdate(
      { user_id: req.userId },
      { $set: updateFields },
      { new: true, upsert: true, runValidators: true }
    );

    const financialContext = await getUserFinancialContext(req.userId, month);

    const recommendations = generateInvestmentRecommendations({
      riskTolerance: profile.risk_tolerance,
      financialGoal: profile.financial_goal,
      investmentHorizon: profile.investment_horizon,
      monthlyIncome: financialContext.monthlyIncome,
      totalExpenses: financialContext.totalExpenses,
      customInvestable: profile.monthly_investable_override,
      currentEmergencyFund: profile.current_emergency_fund,
    });

    res.json({
      message: "Investment profile updated successfully.",
      profile,
      financialContext,
      recommendations,
    });
  } catch (err) {
    console.error("Error updating investment profile:", err);
    res.status(500).json({ message: "Failed to update investment profile." });
  }
});

/**
 * POST /api/investment/recommend
 * Dynamic recommendation endpoint (allows exploring different scenarios without saving)
 */
router.post("/recommend", async (req, res) => {
  try {
    const {
      risk_tolerance,
      financial_goal,
      investment_horizon,
      monthly_income,
      total_expenses,
      custom_investable_amount,
      current_emergency_fund,
      month,
    } = req.body;

    let income = monthly_income;
    let expenses = total_expenses;

    // If not supplied, pull from DB
    if (income === undefined || expenses === undefined) {
      const fin = await getUserFinancialContext(req.userId, month);
      if (income === undefined) income = fin.monthlyIncome;
      if (expenses === undefined) expenses = fin.totalExpenses;
    }

    const recommendations = generateInvestmentRecommendations({
      riskTolerance: risk_tolerance || "Medium",
      financialGoal: financial_goal || "Wealth Creation",
      investmentHorizon: investment_horizon || "Medium Term (3-5 years)",
      monthlyIncome: Number(income) || 0,
      totalExpenses: Number(expenses) || 0,
      customInvestable:
        custom_investable_amount !== undefined && custom_investable_amount !== ""
          ? Number(custom_investable_amount)
          : null,
      currentEmergencyFund: Number(current_emergency_fund) || 0,
    });

    res.json(recommendations);
  } catch (err) {
    console.error("Error computing investment recommendations:", err);
    res.status(500).json({ message: "Failed to generate investment recommendations." });
  }
});

/**
 * POST /api/investment/calculate-sip
 * Interactive SIP & Wealth Growth Calculator
 */
router.post("/calculate-sip", (req, res) => {
  try {
    const { monthlyInvestment, expectedReturnAnnual, years, initialLumpSum } = req.body;

    const calculation = calculateSipCorpus({
      monthlyInvestment: Number(monthlyInvestment) || 5000,
      expectedReturnAnnual: Number(expectedReturnAnnual) || 12,
      years: Number(years) || 10,
      initialLumpSum: Number(initialLumpSum) || 0,
    });

    res.json(calculation);
  } catch (err) {
    console.error("Error calculating SIP projection:", err);
    res.status(500).json({ message: "Failed to compute SIP projection." });
  }
});

module.exports = router;


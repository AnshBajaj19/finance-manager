const express = require("express");
const mongoose = require("mongoose");
const Income = require("../models/Income");
const Expense = require("../models/Expense");
const Budget = require("../models/Budget");
const auth = require("../middleware/auth");
const { buildDateFilter } = require("../utils/dateRange");

const router = express.Router();
router.use(auth);

const getCurrentMonthStr = () => new Date().toISOString().slice(0, 7);

// Discretionary and essential category classification
const DISCRETIONARY_CATEGORIES = ["Shopping", "Entertainment", "Other"];
const ESSENTIAL_CATEGORIES = ["Bills", "Rent/Housing", "Healthcare", "Education"];
const VARIABLE_CATEGORIES = ["Food", "Transport"];

/**
 * Compute the 5-pillar Financial Health Assessment (0 - 100)
 */
async function computeFinancialHealth(userId, targetMonth) {
  const { filter } = buildDateFilter({ month: targetMonth });
  const match = { user_id: new mongoose.Types.ObjectId(userId) };
  if (filter) match.date = filter;

  // 1. Target Month's Total Income
  const incomeAgg = await Income.aggregate([
    { $match: match },
    { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
  ]);
  let monthlyIncome = incomeAgg[0]?.total || 0;

  // Fallback: If no income entered for targetMonth, fetch latest known month's income
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

  // 2. Target Month's Expenses grouped by category
  const expenseAgg = await Expense.aggregate([
    { $match: match },
    { $group: { _id: "$category", total: { $sum: "$amount" }, count: { $sum: 1 } } },
  ]);

  let totalExpenses = 0;
  const categoryBreakdown = {};
  let discretionaryTotal = 0;
  let essentialTotal = 0;

  for (const item of expenseAgg) {
    totalExpenses += item.total;
    categoryBreakdown[item._id] = item.total;

    if (DISCRETIONARY_CATEGORIES.includes(item._id)) {
      discretionaryTotal += item.total;
    } else if (ESSENTIAL_CATEGORIES.includes(item._id)) {
      essentialTotal += item.total;
    } else {
      // Food & Transport: Treat 70% as essential lifestyle baseline, 30% as discretionary
      discretionaryTotal += item.total * 0.3;
      essentialTotal += item.total * 0.7;
    }
  }

  const currentSavings = monthlyIncome - totalExpenses;
  const savingsRatio = monthlyIncome > 0 ? (currentSavings / monthlyIncome) * 100 : 0;
  const expenseRatio = monthlyIncome > 0 ? (totalExpenses / monthlyIncome) * 100 : 0;
  const discretionaryRatio = totalExpenses > 0 ? (discretionaryTotal / totalExpenses) * 100 : 0;

  // 3. Budget Adherence (Module 3 integration)
  const userBudgets = await Budget.find({ user_id: userId, month: targetMonth });
  let totalBudgetAmount = 0;
  let totalBudgetSpent = 0;
  let budgetsExceededCount = 0;
  const budgetDetails = [];

  for (const b of userBudgets) {
    const spent = categoryBreakdown[b.category] || 0;
    const remaining = b.amount - spent;
    const pct = b.amount > 0 ? Math.round((spent / b.amount) * 100) : 0;
    const isExceeded = spent > b.amount;
    if (isExceeded) budgetsExceededCount++;

    totalBudgetAmount += b.amount;
    totalBudgetSpent += spent;

    budgetDetails.push({
      category: b.category,
      budget: b.amount,
      spent,
      remaining,
      percentage: pct,
      isExceeded,
    });
  }

  // 4. Historical Consistency across past months
  const [allIncomeHistory, allExpenseHistory] = await Promise.all([
    Income.aggregate([
      { $match: { user_id: new mongoose.Types.ObjectId(userId) } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$date" } },
          total: { $sum: "$amount" },
        },
      },
    ]),
    Expense.aggregate([
      { $match: { user_id: new mongoose.Types.ObjectId(userId) } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$date" } },
          total: { $sum: "$amount" },
        },
      },
    ]),
  ]);

  const monthHistoryMap = {};
  for (const item of allIncomeHistory) {
    if (!monthHistoryMap[item._id]) monthHistoryMap[item._id] = { income: 0, expenses: 0 };
    monthHistoryMap[item._id].income = item.total;
  }
  for (const item of allExpenseHistory) {
    if (!monthHistoryMap[item._id]) monthHistoryMap[item._id] = { income: 0, expenses: 0 };
    monthHistoryMap[item._id].expenses = item.total;
  }

  const sortedMonths = Object.keys(monthHistoryMap).sort();
  const pastMonths = sortedMonths.filter((m) => m <= targetMonth);
  let positiveMonthsCount = 0;
  const historySeries = [];

  for (const m of pastMonths) {
    const inc = monthHistoryMap[m].income;
    const exp = monthHistoryMap[m].expenses;
    const sav = inc - exp;
    if (sav > 0) positiveMonthsCount++;
    historySeries.push({
      month: m,
      income: inc,
      expenses: exp,
      savings: sav,
      rate: inc > 0 ? Math.round((sav / inc) * 1000) / 10 : 0,
    });
  }

  // ========================================================
  // SCORING ALGORITHM (5 Pillars = Total 100 points)
  // ========================================================

  // Pillar 1: Savings Ratio (Max 25 pts)
  let p1Score = 0;
  let p1Rating = "Poor";
  if (savingsRatio >= 30) {
    p1Score = 25;
    p1Rating = "Outstanding";
  } else if (savingsRatio >= 20) {
    p1Score = 20;
    p1Rating = "Healthy";
  } else if (savingsRatio >= 10) {
    p1Score = 14;
    p1Rating = "Moderate";
  } else if (savingsRatio > 0) {
    p1Score = 8;
    p1Rating = "Low";
  } else {
    p1Score = 0;
    p1Rating = "Deficit";
  }

  // Pillar 2: Expense-to-Income Ratio (Max 20 pts)
  let p2Score = 0;
  let p2Rating = "Critical";
  if (monthlyIncome === 0 && totalExpenses > 0) {
    p2Score = 0;
    p2Rating = "No Income Recorded";
  } else if (expenseRatio <= 60) {
    p2Score = 20;
    p2Rating = "Excellent";
  } else if (expenseRatio <= 75) {
    p2Score = 16;
    p2Rating = "Balanced";
  } else if (expenseRatio <= 85) {
    p2Score = 11;
    p2Rating = "High";
  } else if (expenseRatio <= 98) {
    p2Score = 6;
    p2Rating = "Strained";
  } else {
    p2Score = 2;
    p2Rating = "Critical";
  }

  // Pillar 3: Budget Adherence (Max 20 pts)
  let p3Score = 0;
  let p3Rating = "Unbudgeted";
  if (userBudgets.length > 0) {
    if (budgetsExceededCount === 0) {
      p3Score = 20;
      p3Rating = "Perfect Adherence";
    } else if (budgetsExceededCount === 1 && totalBudgetSpent <= totalBudgetAmount * 1.05) {
      p3Score = 14;
      p3Rating = "Minor Overrun";
    } else if (totalBudgetSpent <= totalBudgetAmount * 1.15) {
      p3Score = 9;
      p3Rating = "Moderate Overrun";
    } else {
      p3Score = 4;
      p3Rating = "Budget Exceeded";
    }
  } else {
    // Default neutral score if no budgets created yet
    p3Score = 12;
    p3Rating = "No Budgets Set";
  }

  // Pillar 4: Unnecessary / Discretionary Spending Ratio (Max 20 pts)
  let p4Score = 0;
  let p4Rating = "High Discretionary";
  if (totalExpenses === 0) {
    p4Score = 20;
    p4Rating = "No Expenses";
  } else if (discretionaryRatio <= 20) {
    p4Score = 20;
    p4Rating = "Very Disciplined";
  } else if (discretionaryRatio <= 32) {
    p4Score = 16;
    p4Rating = "Controlled";
  } else if (discretionaryRatio <= 45) {
    p4Score = 11;
    p4Rating = "Elevated Leisure";
  } else if (discretionaryRatio <= 60) {
    p4Score = 6;
    p4Rating = "High Discretionary";
  } else {
    p4Score = 2;
    p4Rating = "Excessive";
  }

  // Pillar 5: Consistency of Savings (Max 15 pts)
  let p5Score = 0;
  let p5Rating = "Inconsistent";
  const totalTrackedMonths = historySeries.length;
  if (totalTrackedMonths >= 3) {
    const consistencyRatio = positiveMonthsCount / totalTrackedMonths;
    if (consistencyRatio >= 0.85) {
      p5Score = 15;
      p5Rating = "Very Consistent";
    } else if (consistencyRatio >= 0.65) {
      p5Score = 11;
      p5Rating = "Generally Consistent";
    } else if (consistencyRatio >= 0.4) {
      p5Score = 6;
      p5Rating = "Irregular";
    } else {
      p5Score = 2;
      p5Rating = "Consistent Deficit";
    }
  } else if (totalTrackedMonths > 0) {
    // 1 or 2 months: give baseline
    p5Score = currentSavings >= 0 ? 12 : 4;
    p5Rating = currentSavings >= 0 ? "Positive Baseline" : "Negative Baseline";
  } else {
    p5Score = 8;
    p5Rating = "Insufficient History";
  }

  // Final Composite Score (0 - 100)
  const totalScore = Math.min(100, Math.max(0, p1Score + p2Score + p3Score + p4Score + p5Score));

  // Determine Overall Classification
  let healthGrade = "Fair";
  let healthSummary = "Moderate Financial Health";
  let gradeColor = "var(--primary)";

  if (totalScore >= 85) {
    healthGrade = "Excellent";
    healthSummary = "Outstanding financial control and disciplined savings habits.";
    gradeColor = "#16a34a"; // Green
  } else if (totalScore >= 70) {
    healthGrade = "Good";
    healthSummary = "Healthy financial position with consistent savings buffer.";
    gradeColor = "#2563eb"; // Blue
  } else if (totalScore >= 50) {
    healthGrade = "Moderate";
    healthSummary = "Stable, but discretionary spending or narrow margins present risk.";
    gradeColor = "#d97706"; // Amber
  } else if (totalScore >= 35) {
    healthGrade = "Needs Attention";
    healthSummary = "High expense ratio and low savings cushion require proactive management.";
    gradeColor = "#ea580c"; // Orange
  } else {
    healthGrade = "Critical Risk";
    healthSummary = "Expenses exceed or consume entire income. Immediate budget adjustments needed.";
    gradeColor = "#dc2626"; // Red
  }

  // ========================================================
  // RULE-BASED PERSONALIZED RECOMMENDATIONS (Dynamic & Quantitative)
  // ========================================================
  const recommendations = [];

  // Shopping recommendation
  const shoppingAmount = categoryBreakdown["Shopping"] || 0;
  if (shoppingAmount > 0 && (shoppingAmount / (totalExpenses || 1)) > 0.15) {
    const cutAmount = Math.round(shoppingAmount * 0.15);
    recommendations.push({
      id: "rec_shopping",
      type: "discretionary",
      priority: "high",
      title: "Trim Shopping Expenses",
      message: `Try reducing shopping expenses by 15% (saving ~₹${cutAmount.toLocaleString()}) to improve your monthly savings ratio.`,
      impact: `+${Math.round((cutAmount / (monthlyIncome || 1)) * 100)}% savings rate`,
    });
  }

  // Entertainment recommendation
  const entertainmentAmount = categoryBreakdown["Entertainment"] || 0;
  if (entertainmentAmount > 0 && (entertainmentAmount / (totalExpenses || 1)) > 0.10) {
    const cutAmount = Math.round(entertainmentAmount * 0.20);
    recommendations.push({
      id: "rec_entertainment",
      type: "discretionary",
      priority: "medium",
      title: "Optimize Leisure & Subscriptions",
      message: `Entertainment took ₹${entertainmentAmount.toLocaleString()} this month. Trimming non-essential activities can save ~₹${cutAmount.toLocaleString()}.`,
      impact: `+₹${cutAmount.toLocaleString()} buffer`,
    });
  }

  // Budget overrun recommendation
  if (budgetsExceededCount > 0) {
    const exceeded = budgetDetails.filter((b) => b.isExceeded);
    const catNames = exceeded.map((b) => b.category).join(", ");
    recommendations.push({
      id: "rec_budget_exceeded",
      type: "budget",
      priority: "high",
      title: "Enforce Category Budget Limits",
      message: `You exceeded your budget limits in ${catNames}. Set spending cap alerts or redistribute allocations from under-spent categories.`,
      impact: "Avoid cash flow leaks",
    });
  } else if (userBudgets.length === 0) {
    recommendations.push({
      id: "rec_set_budgets",
      type: "budget",
      priority: "medium",
      title: "Activate Monthly Budgets",
      message: "You haven't set monthly category budgets yet. Creating monthly category budgets will instantly raise your health score.",
      impact: "+8 health score points",
    });
  }

  // Savings ratio recommendation
  if (savingsRatio < 20) {
    const target20 = Math.round(monthlyIncome * 0.20);
    const shortfall = Math.max(0, target20 - currentSavings);
    recommendations.push({
      id: "rec_savings_rate",
      type: "savings",
      priority: savingsRatio <= 0 ? "high" : "medium",
      title: "Target 20% Standard Savings Rule",
      message: `Your current savings ratio is ${Math.round(savingsRatio)}%. Aim for the 50/30/20 rule (target: ₹${target20.toLocaleString()}/month, shortfall: ₹${shortfall.toLocaleString()}).`,
      impact: "Stronger financial security",
    });
  } else {
    recommendations.push({
      id: "rec_investment_ready",
      type: "growth",
      priority: "low",
      title: "Healthy Surplus Available for Investment",
      message: `You are consistently saving ${Math.round(savingsRatio)}% of income! You are in an ideal position to explore investments.`,
      impact: "Wealth compounding",
    });
  }

  // Return full structured assessment
  return {
    month: targetMonth,
    financialHealthScore: totalScore,
    grade: healthGrade,
    summary: healthSummary,
    gradeColor,
    metrics: {
      monthlyIncome,
      totalExpenses,
      currentSavings,
      savingsRatio: Math.round(savingsRatio * 10) / 10,
      expenseRatio: Math.round(expenseRatio * 10) / 10,
      discretionaryRatio: Math.round(discretionaryRatio * 10) / 10,
      essentialRatio: Math.round((100 - discretionaryRatio) * 10) / 10,
      budgetsActive: userBudgets.length,
      budgetsExceeded: budgetsExceededCount,
    },
    pillars: [
      {
        name: "Savings Ratio",
        weight: 25,
        score: p1Score,
        rating: p1Rating,
        actual: `${Math.round(savingsRatio)}%`,
        target: "≥ 20% of income",
        description: "Portion of monthly income converted into surplus funds.",
      },
      {
        name: "Expense-to-Income",
        weight: 20,
        score: p2Score,
        rating: p2Rating,
        actual: `${Math.round(expenseRatio)}%`,
        target: "≤ 75% of income",
        description: "How much of earnings is consumed by routine expenditures.",
      },
      {
        name: "Budget Adherence",
        weight: 20,
        score: p3Score,
        rating: p3Rating,
        actual: userBudgets.length > 0 ? `${budgetsExceededCount} exceeded` : "No budgets set",
        target: "0 categories exceeded",
        description: "Discipline in adhering to pre-set spending limits.",
      },
      {
        name: "Discretionary Spending",
        weight: 20,
        score: p4Score,
        rating: p4Rating,
        actual: `${Math.round(discretionaryRatio)}%`,
        target: "≤ 30% of expenses",
        description: "Proportion spent on shopping, entertainment, and non-essentials.",
      },
      {
        name: "Consistency of Savings",
        weight: 15,
        score: p5Score,
        rating: p5Rating,
        actual: `${positiveMonthsCount}/${Math.max(1, totalTrackedMonths)} months`,
        target: "Positive across past 3-6 months",
        description: "Track record of regular monthly net surplus accumulation.",
      },
    ],
    categoryBreakdown,
    budgetDetails,
    historySeries,
    recommendations,
  };
}

// GET /api/financial-health?month=YYYY-MM
// Returns complete Financial Health Score (0-100), 5 pillars, and recommendations
router.get("/", async (req, res) => {
  try {
    const targetMonth = req.query.month || getCurrentMonthStr();
    if (!/^\d{4}-\d{2}$/.test(targetMonth)) {
      return res.status(400).json({ message: "Month must be in YYYY-MM format." });
    }

    const assessment = await computeFinancialHealth(req.userId, targetMonth);
    res.json(assessment);
  } catch (err) {
    console.error("Financial health computation error:", err);
    res.status(500).json({ message: "Could not compute financial health.", error: err.message });
  }
});

module.exports = router;

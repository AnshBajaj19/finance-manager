const express = require("express");
const mongoose = require("mongoose");
const Income = require("../models/Income");
const Expense = require("../models/Expense");
const Budget = require("../models/Budget");
const auth = require("../middleware/auth");
const { buildDateFilter } = require("../utils/dateRange");

const router = express.Router();
router.use(auth);

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://localhost:8000";

const getCurrentMonthStr = () => new Date().toISOString().slice(0, 7);

// Helper: Calculate monthly financial aggregates for a user
async function getUserMonthlyAggregates(userId, targetMonth) {
  const { filter } = buildDateFilter({ month: targetMonth });
  const match = { user_id: new mongoose.Types.ObjectId(userId) };
  if (filter) match.date = filter;

  // 1. Current Month's Income
  const incomeAgg = await Income.aggregate([
    { $match: match },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);
  let monthlyIncome = incomeAgg[0]?.total || 0;

  // If no income recorded for targetMonth, fetch latest recorded monthly income or average
  if (monthlyIncome === 0) {
    const latestIncome = await Income.find({ user_id: userId })
      .sort({ date: -1 })
      .limit(5);
    if (latestIncome.length > 0) {
      // Sum income from the most recent active month
      const latestMonthStr = latestIncome[0].date.toISOString().slice(0, 7);
      const { filter: latestFilter } = buildDateFilter({ month: latestMonthStr });
      const recentAgg = await Income.aggregate([
        { $match: { user_id: new mongoose.Types.ObjectId(userId), date: latestFilter } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]);
      monthlyIncome = recentAgg[0]?.total || 0;
    }
  }

  // 2. Current Month's Expenses by category
  const expenseAgg = await Expense.aggregate([
    { $match: match },
    { $group: { _id: "$category", total: { $sum: "$amount" } } },
  ]);

  const categoryExpenses = {
    Food: 0,
    Transport: 0,
    Shopping: 0,
    Bills: 0,
    Other: 0,
  };

  let totalExpenses = 0;
  for (const item of expenseAgg) {
    totalExpenses += item.total;
    if (item._id in categoryExpenses) {
      categoryExpenses[item._id] = item.total;
    } else {
      categoryExpenses.Other += item.total;
    }
  }

  // 3. Historical Savings (Past Months)
  // Find all income and expenses grouped by YYYY-MM
  const [allMonthlyIncome, allMonthlyExpenses] = await Promise.all([
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

  const monthMap = {};
  for (const inc of allMonthlyIncome) {
    if (!monthMap[inc._id]) monthMap[inc._id] = { income: 0, expenses: 0 };
    monthMap[inc._id].income = inc.total;
  }
  for (const exp of allMonthlyExpenses) {
    if (!monthMap[exp._id]) monthMap[exp._id] = { income: 0, expenses: 0 };
    monthMap[exp._id].expenses = exp.total;
  }

  // Calculate savings per past month excluding targetMonth
  const pastSavingsList = [];
  const historyList = [];
  const sortedMonths = Object.keys(monthMap).sort();

  for (const m of sortedMonths) {
    const inc = monthMap[m].income;
    const exp = monthMap[m].expenses;
    const sav = inc - exp;
    const rate = inc > 0 ? Math.round((sav / inc) * 1000) / 10 : 0;
    historyList.push({
      month: m,
      income: inc,
      expenses: exp,
      savings: sav,
      savingsRate: rate,
    });

    if (m < targetMonth) {
      pastSavingsList.push(sav);
    }
  }

  let previousSavings = 0;
  if (pastSavingsList.length > 0) {
    // Average of the past months (capped at last 6 months)
    const recentPast = pastSavingsList.slice(-6);
    const sum = recentPast.reduce((a, b) => a + b, 0);
    previousSavings = Math.round(sum / recentPast.length);
  } else if (monthlyIncome > 0 && totalExpenses > 0) {
    previousSavings = Math.max(0, monthlyIncome - totalExpenses);
  }

  const [y, mStr] = targetMonth.split("-");
  const monthNum = parseInt(mStr, 10);

  return {
    monthlyIncome,
    totalExpenses,
    categoryExpenses,
    previousSavings,
    monthNum,
    targetMonth,
    historyList,
  };
}

// GET /api/savings/predict?month=YYYY-MM
// Generates automated monthly savings prediction using user data and ML model
router.get("/predict", async (req, res) => {
  try {
    const targetMonth = req.query.month || getCurrentMonthStr();
    if (!/^\d{4}-\d{2}$/.test(targetMonth)) {
      return res.status(400).json({ message: "Month must be in YYYY-MM format." });
    }

    const agg = await getUserMonthlyAggregates(req.userId, targetMonth);

    const mlFeatures = {
      monthly_income: agg.monthlyIncome,
      total_expenses: agg.totalExpenses,
      food_expenses: agg.categoryExpenses.Food,
      transport_expenses: agg.categoryExpenses.Transport,
      shopping_expenses: agg.categoryExpenses.Shopping,
      bills_expenses: agg.categoryExpenses.Bills,
      previous_savings: agg.previousSavings,
      month: agg.monthNum,
    };

    let mlData = null;
    let mlConnected = false;

    try {
      const mlResponse = await fetch(`${ML_SERVICE_URL}/predict-savings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mlFeatures),
      });

      if (mlResponse.ok) {
        mlData = await mlResponse.json();
        mlConnected = true;
      }
    } catch (err) {
      console.warn("Could not reach Python ML service, using baseline calculation:", err.message);
    }

    // Fallback if ML service is unreachable
    if (!mlData) {
      const baselineSavings = Math.round((agg.monthlyIncome - agg.totalExpenses) / 50) * 50;
      const rate = agg.monthlyIncome > 0 ? Math.round((baselineSavings / agg.monthlyIncome) * 1000) / 10 : 0;
      mlData = {
        predicted_savings: baselineSavings,
        monthly_income: agg.monthlyIncome,
        total_expenses: agg.totalExpenses,
        savings_rate_percent: rate,
        status: rate >= 20 ? "healthy" : rate >= 10 ? "moderate" : rate >= 0 ? "tight" : "deficit",
        status_text: rate >= 20 ? "Good Savings (Baseline)" : "Moderate Savings (Baseline)",
        insight: "ML service is offline; showing rule-based baseline projection. Start Python ML service for full ML regression prediction.",
        features_used: mlFeatures,
        model_metadata: {
          model_name: "Baseline Rule Engine",
          r2_score: null,
          mae: null,
        },
      };
    }

    res.json({
      ...mlData,
      mlConnected,
      targetMonth,
      category_breakdown: agg.categoryExpenses,
      history: agg.historyList,
    });
  } catch (err) {
    console.error("Savings prediction error:", err);
    res.status(500).json({ message: "Could not compute savings prediction.", error: err.message });
  }
});

// POST /api/savings/simulate
// Interactive what-if simulator with custom input features
router.post("/simulate", async (req, res) => {
  try {
    const {
      monthly_income = 40000,
      total_expenses = 30000,
      food_expenses = 5000,
      transport_expenses = 3000,
      shopping_expenses = 4000,
      bills_expenses = 6000,
      previous_savings = 9000,
      month = new Date().getMonth() + 1,
    } = req.body;

    const payload = {
      monthly_income: Number(monthly_income),
      total_expenses: Number(total_expenses),
      food_expenses: Number(food_expenses),
      transport_expenses: Number(transport_expenses),
      shopping_expenses: Number(shopping_expenses),
      bills_expenses: Number(bills_expenses),
      previous_savings: Number(previous_savings),
      month: Number(month),
    };

    try {
      const mlResponse = await fetch(`${ML_SERVICE_URL}/predict-savings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (mlResponse.ok) {
        const data = await mlResponse.json();
        return res.json({ ...data, mlConnected: true });
      }
    } catch (err) {
      console.warn("ML service offline for simulation:", err.message);
    }

    // Fallback baseline simulation
    const rawSavings = payload.monthly_income - payload.total_expenses;
    const rate = payload.monthly_income > 0 ? Math.round((rawSavings / payload.monthly_income) * 1000) / 10 : 0;

    res.json({
      predicted_savings: Math.round(rawSavings / 50) * 50,
      monthly_income: payload.monthly_income,
      total_expenses: payload.total_expenses,
      savings_rate_percent: rate,
      status: rate >= 20 ? "healthy" : rate >= 10 ? "moderate" : "tight",
      status_text: rate >= 20 ? "Strong Savings" : "Moderate Savings",
      insight: "Simulated projection based on provided financial parameters.",
      features_used: payload,
      mlConnected: false,
      model_metadata: {
        model_name: "Baseline Rule Engine",
        r2_score: null,
        mae: null,
      },
    });
  } catch (err) {
    res.status(500).json({ message: "Could not run savings simulation.", error: err.message });
  }
});

// GET /api/savings/history
// Returns month-by-month financial history for logged in user
router.get("/history", async (req, res) => {
  try {
    const agg = await getUserMonthlyAggregates(req.userId, getCurrentMonthStr());
    res.json(agg.historyList);
  } catch (err) {
    res.status(500).json({ message: "Could not fetch savings history.", error: err.message });
  }
});

// GET /api/savings/model-info
// Returns comparison table of Linear Regression, Decision Tree, and Random Forest models
router.get("/model-info", async (req, res) => {
  try {
    const mlResponse = await fetch(`${ML_SERVICE_URL}/savings-model-info`);
    if (mlResponse.ok) {
      const info = await mlResponse.json();
      return res.json(info);
    }
  } catch (err) {
    console.warn("Could not fetch model info from ML service:", err.message);
  }

  // Fallback info if ML service is not yet started
  res.json({
    best_model: "Linear Regression",
    feature_names: [
      "monthly_income",
      "total_expenses",
      "food_expenses",
      "transport_expenses",
      "shopping_expenses",
      "bills_expenses",
      "previous_savings",
      "month",
    ],
    metrics: { name: "Linear Regression", mae: 773.07, rmse: 1017.04, r2: 0.9957 },
    comparison: [
      { name: "Linear Regression", mae: 773.07, rmse: 1017.04, r2: 0.9957 },
      { name: "Decision Tree Regression", mae: 2294.21, rmse: 3243.79, r2: 0.9561 },
      { name: "Random Forest Regression", mae: 1199.06, rmse: 2000.18, r2: 0.9833 },
    ],
    training_samples: 3000,
  });
});

module.exports = router;

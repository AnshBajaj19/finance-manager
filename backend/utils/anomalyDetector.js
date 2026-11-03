const mongoose = require("mongoose");
const Expense = require("../models/Expense");
const Budget = require("../models/Budget");
const User = require("../models/User");
const AlertNotification = require("../models/AlertNotification");
const AlertSettings = require("../models/AlertSettings");
const { sendAlertEmail } = require("./emailService");

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://localhost:8000";

/**
 * Calculates mean and sample standard deviation
 */
function computeStats(values) {
  if (!values || values.length === 0) return { count: 0, mean: 0, stdDev: 0 };
  const count = values.length;
  const sum = values.reduce((acc, v) => acc + v, 0);
  const mean = sum / count;

  if (count < 2) return { count, mean, stdDev: 0 };

  const variance = values.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / (count - 1);
  const stdDev = Math.sqrt(variance);

  return { count, mean, stdDev };
}

/**
 * Checks an individual transaction against the user's category history
 */
async function detectExpenseAnomaly(userId, expense) {
  const settings = (await AlertSettings.findOne({ user_id: userId })) || {
    anomaly_threshold_multiplier: 2.5,
    z_score_threshold: 2.0,
    notify_unusual_expenses: true,
  };

  const amount = Number(expense.amount);
  const category = expense.category;

  // Fetch past expenses in this category (excluding current expense if updating)
  const pastExpenses = await Expense.find({
    user_id: userId,
    category: category,
    _id: { $ne: expense._id },
  }).sort({ date: -1 }).limit(100);

  const amounts = pastExpenses.map((e) => e.amount);
  const { count, mean, stdDev } = computeStats(amounts);

  // If very few records (less than 2), establish baseline without alerting unless extreme absolute spike (e.g. > 10,000)
  if (count < 2) {
    if (amount >= 15000) {
      return {
        isAnomaly: true,
        reason: `Large high-value transaction of ₹${amount.toLocaleString()} detected in ${category} without prior spending baseline.`,
        categoryAverage: amount,
        multiplier: 1.0,
        zScore: null,
        method: "high_absolute_threshold",
      };
    }
    return { isAnomaly: false };
  }

  const multiplier = mean > 0 ? amount / mean : 1.0;
  let zScore = stdDev > 0 ? (amount - mean) / stdDev : 0;

  // Try Python ML Service anomaly detection if available
  let mlResult = null;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1200);

    const mlRes = await fetch(`${ML_SERVICE_URL}/detect-anomaly`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount,
        category,
        history: amounts,
        multiplier_threshold: settings.anomaly_threshold_multiplier,
        z_threshold: settings.z_score_threshold,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (mlRes.ok) {
      mlResult = await mlRes.json();
    }
  } catch (err) {
    // Graceful fallback to Node-side statistical engine
  }

  if (mlResult && mlResult.is_anomaly !== undefined) {
    return {
      isAnomaly: mlResult.is_anomaly,
      reason: mlResult.reason,
      categoryAverage: mlResult.category_average || mean,
      multiplier: mlResult.multiplier || multiplier,
      zScore: mlResult.z_score !== undefined ? mlResult.z_score : zScore,
      method: mlResult.method || "ml_service",
    };
  }

  // Local Statistical & Rule-Based Detection:
  // Condition 1: Exceeds category average * multiplier (with minimum threshold floor of ₹500)
  const isMultiplierSpike =
    amount >= 500 && multiplier >= settings.anomaly_threshold_multiplier;

  // Condition 2: Statistical Z-Score Outlier (Z >= 2.0 and at least 3 historical points)
  const isZScoreOutlier = count >= 3 && stdDev > 0 && zScore >= settings.z_score_threshold;

  if (isMultiplierSpike || isZScoreOutlier) {
    let reason = "";
    if (isMultiplierSpike && isZScoreOutlier) {
      reason = `Expense of ₹${amount.toLocaleString()} is ${multiplier.toFixed(1)}x higher than your ${category} average of ₹${Math.round(mean).toLocaleString()} (Z-Score: ${zScore.toFixed(2)} - Statistical Outlier).`;
    } else if (isMultiplierSpike) {
      reason = `Expense of ₹${amount.toLocaleString()} is ${multiplier.toFixed(1)}x your typical ${category} spending of ₹${Math.round(mean).toLocaleString()}.`;
    } else {
      reason = `Expense of ₹${amount.toLocaleString()} exhibits unusual statistical divergence (Z-Score: ${zScore.toFixed(2)}) from your typical ${category} patterns.`;
    }

    return {
      isAnomaly: true,
      reason,
      categoryAverage: Math.round(mean),
      multiplier: Math.round(multiplier * 10) / 10,
      zScore: Math.round(zScore * 100) / 100,
      method: isZScoreOutlier ? "z_score_statistical" : "rule_threshold",
    };
  }

  return { isAnomaly: false, categoryAverage: Math.round(mean), multiplier, zScore };
}

/**
 * Checks if the expense caused a category budget exceedance
 */
async function checkBudgetExceeded(userId, expense) {
  const monthStr = expense.date ? new Date(expense.date).toISOString().slice(0, 7) : new Date().toISOString().slice(0, 7);

  const budget = await Budget.findOne({
    user_id: userId,
    category: expense.category,
    month: monthStr,
  });

  if (!budget) return null;

  // Calculate total spent in this category this month
  const startOfMonth = new Date(`${monthStr}-01T00:00:00.000Z`);
  const [year, m] = monthStr.split("-").map(Number);
  const endOfMonth = new Date(Date.UTC(year, m, 0, 23, 59, 59, 999));

  const agg = await Expense.aggregate([
    {
      $match: {
        user_id: new mongoose.Types.ObjectId(userId),
        category: expense.category,
        date: { $gte: startOfMonth, $lte: endOfMonth },
      },
    },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);

  const totalSpent = agg[0]?.total || 0;
  const isExceeded = totalSpent > budget.amount;
  const percentUsed = Math.round((totalSpent / budget.amount) * 100);

  if (isExceeded) {
    return {
      isExceeded: true,
      budgetAmount: budget.amount,
      totalSpent,
      exceededBy: totalSpent - budget.amount,
      percentUsed,
      category: expense.category,
      month: monthStr,
      reason: `Your monthly ${expense.category} spending (₹${totalSpent.toLocaleString()}) has exceeded your budget of ₹${budget.amount.toLocaleString()} by ₹${(totalSpent - budget.amount).toLocaleString()} (${percentUsed}% used).`,
    };
  }

  return null;
}

/**
 * Orchestrator: Runs anomaly detection & budget checks, persists alerts, and dispatches email
 */
async function processExpenseAlerts(userId, expense) {
  const user = await User.findById(userId);
  if (!user) return { alerts: [] };

  const settings = (await AlertSettings.findOne({ user_id: userId })) || {
    email_alerts_enabled: true,
    notify_unusual_expenses: true,
    notify_budget_exceeded: true,
  };

  const triggeredAlerts = [];

  // 1. Check for Unusual Expense Anomaly
  if (settings.notify_unusual_expenses !== false) {
    const anomaly = await detectExpenseAnomaly(userId, expense);

    if (anomaly.isAnomaly) {
      const alert = await AlertNotification.create({
        user_id: userId,
        type: "unusual_expense",
        title: "⚠️ Unusual Expense Detected",
        message: anomaly.reason,
        severity: "warning",
        expense_id: expense._id,
        metadata: {
          amount: expense.amount,
          category: expense.category,
          description: expense.description,
          categoryAverage: anomaly.categoryAverage,
          multiplier: anomaly.multiplier,
          zScore: anomaly.zScore,
        },
      });

      // Send email alert if enabled
      let emailResult = null;
      if (settings.email_alerts_enabled) {
        emailResult = await sendAlertEmail({
          to: user.email,
          recipientName: user.name,
          alertType: "unusual_expense",
          title: "Unusual Expense Detected",
          message: anomaly.reason,
          metadata: {
            amount: expense.amount,
            category: expense.category,
            description: expense.description,
            categoryAverage: anomaly.categoryAverage,
            multiplier: anomaly.multiplier,
            zScore: anomaly.zScore,
          },
        });

        if (emailResult.success) {
          alert.email_sent = true;
          alert.email_recipient = user.email;
        } else {
          alert.email_error = emailResult.error || "Email delivery failed";
        }
        await alert.save();
      }

      triggeredAlerts.push({
        alert,
        anomaly,
        emailResult,
      });
    }
  }

  // 2. Check for Budget Exceeded
  if (settings.notify_budget_exceeded !== false) {
    const budgetCheck = await checkBudgetExceeded(userId, expense);

    if (budgetCheck && budgetCheck.isExceeded) {
      // Avoid duplicate alert if already sent in the last 12 hours for the same budget
      const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);
      const existingAlert = await AlertNotification.findOne({
        user_id: userId,
        type: "budget_exceeded",
        "metadata.category": expense.category,
        createdAt: { $gte: twelveHoursAgo },
      });

      if (!existingAlert) {
        const budgetAlert = await AlertNotification.create({
          user_id: userId,
          type: "budget_exceeded",
          title: `🚨 ${expense.category} Budget Exceeded!`,
          message: budgetCheck.reason,
          severity: "danger",
          expense_id: expense._id,
          metadata: {
            amount: expense.amount,
            category: expense.category,
            description: expense.description,
            budgetAmount: budgetCheck.budgetAmount,
            percentageOfBudget: budgetCheck.percentUsed,
          },
        });

        if (settings.email_alerts_enabled) {
          const emailRes = await sendAlertEmail({
            to: user.email,
            recipientName: user.name,
            alertType: "budget_exceeded",
            title: `${expense.category} Budget Limit Exceeded!`,
            message: budgetCheck.reason,
            metadata: {
              amount: expense.amount,
              category: expense.category,
              description: expense.description,
              budgetAmount: budgetCheck.budgetAmount,
              percentageOfBudget: budgetCheck.percentUsed,
            },
          });

          if (emailRes.success) {
            budgetAlert.email_sent = true;
            budgetAlert.email_recipient = user.email;
          } else {
            budgetAlert.email_error = emailRes.error || "Failed to send email";
          }
          await budgetAlert.save();
        }

        triggeredAlerts.push({
          alert: budgetAlert,
          budgetCheck,
        });
      }
    }
  }

  return { triggeredAlerts };
}

/**
 * Scan all historical expenses of a user and detect all anomalous transactions
 */
async function scanAllUserAnomalies(userId) {
  const allExpenses = await Expense.find({ user_id: userId }).sort({ date: 1 });

  // Group by category
  const categoryGroups = {};
  for (const exp of allExpenses) {
    if (!categoryGroups[exp.category]) categoryGroups[exp.category] = [];
    categoryGroups[exp.category].push(exp);
  }

  const detectedAnomalies = [];

  for (const [category, items] of Object.entries(categoryGroups)) {
    if (items.length < 2) continue;

    const amounts = items.map((e) => e.amount);
    const { mean, stdDev } = computeStats(amounts);

    for (const exp of items) {
      const mult = mean > 0 ? exp.amount / mean : 1.0;
      const zScore = stdDev > 0 ? (exp.amount - mean) / stdDev : 0;

      // Flag if 2.5x category average and >= 500 OR Z-score >= 2.0
      if ((exp.amount >= 500 && mult >= 2.5) || (items.length >= 3 && stdDev > 0 && zScore >= 2.0)) {
        detectedAnomalies.push({
          expenseId: exp._id,
          amount: exp.amount,
          category: exp.category,
          description: exp.description,
          date: exp.date,
          payment_method: exp.payment_method,
          categoryAverage: Math.round(mean),
          multiplier: Math.round(mult * 10) / 10,
          zScore: Math.round(zScore * 100) / 100,
          severity: mult >= 4.0 || zScore >= 3.0 ? "danger" : "warning",
          reason: `₹${exp.amount.toLocaleString()} is ${mult.toFixed(1)}x higher than category average of ₹${Math.round(mean).toLocaleString()} (Z-Score: ${zScore.toFixed(2)})`,
        });
      }
    }
  }

  return detectedAnomalies.reverse(); // newest first
}

module.exports = {
  detectExpenseAnomaly,
  checkBudgetExceeded,
  processExpenseAlerts,
  scanAllUserAnomalies,
};


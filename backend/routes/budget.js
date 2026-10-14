const express = require("express");
const mongoose = require("mongoose");
const Budget = require("../models/Budget");
const Expense = require("../models/Expense");
const auth = require("../middleware/auth");

const router = express.Router();

router.use(auth);

const getCurrentMonth = () => new Date().toISOString().slice(0, 7);

// POST /api/budget - create or update (upsert) a budget for a category and month
router.post("/", async (req, res) => {
  try {
    const { category, amount, month } = req.body;
    const targetMonth = month || getCurrentMonth();

    if (!category || amount === undefined) {
      return res.status(400).json({ message: "Category and amount are required." });
    }

    if (Number(amount) <= 0) {
      return res.status(400).json({ message: "Budget amount must be greater than 0." });
    }

    if (!/^\d{4}-\d{2}$/.test(targetMonth)) {
      return res.status(400).json({ message: "Month must be in YYYY-MM format." });
    }

    // Upsert budget: if already exists for this category and month, update it
    const budget = await Budget.findOneAndUpdate(
      { user_id: req.userId, category, month: targetMonth },
      { amount: Number(amount) },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );

    res.status(201).json(budget);
  } catch (err) {
    if (err.name === "ValidationError") {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: "Could not save budget.", error: err.message });
  }
});

// GET /api/budget - list budgets for a month (default current month)
router.get("/", async (req, res) => {
  try {
    const { month } = req.query;
    const query = { user_id: req.userId };

    if (month && month !== "all") {
      query.month = month;
    } else if (!month) {
      query.month = getCurrentMonth();
    }

    const budgets = await Budget.find(query).sort({ category: 1 });
    res.json(budgets);
  } catch (err) {
    res.status(500).json({ message: "Could not fetch budgets.", error: err.message });
  }
});

// PUT /api/budget/:id - update a budget
router.put("/:id", async (req, res) => {
  try {
    const { amount, category, month } = req.body;
    const budget = await Budget.findOne({ _id: req.params.id, user_id: req.userId });

    if (!budget) {
      return res.status(404).json({ message: "Budget not found." });
    }

    if (amount !== undefined) {
      if (Number(amount) <= 0) {
        return res.status(400).json({ message: "Budget amount must be greater than 0." });
      }
      budget.amount = Number(amount);
    }
    if (category !== undefined) budget.category = category;
    if (month !== undefined) {
      if (!/^\d{4}-\d{2}$/.test(month)) {
        return res.status(400).json({ message: "Month must be in YYYY-MM format." });
      }
      budget.month = month;
    }

    await budget.save();
    res.json(budget);
  } catch (err) {
    if (err.name === "ValidationError") {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: "Could not update budget.", error: err.message });
  }
});

// DELETE /api/budget/:id - delete a budget
router.delete("/:id", async (req, res) => {
  try {
    const budget = await Budget.findOneAndDelete({ _id: req.params.id, user_id: req.userId });
    if (!budget) {
      return res.status(404).json({ message: "Budget not found." });
    }
    res.json({ message: "Budget deleted successfully." });
  } catch (err) {
    res.status(500).json({ message: "Could not delete budget.", error: err.message });
  }
});

// GET /api/budget/status - compare budget against actual spending for a month & compute alerts
// Example: /api/budget/status?month=2026-10
router.get("/status", async (req, res) => {
  try {
    const targetMonth = req.query.month || getCurrentMonth();

    if (!/^\d{4}-\d{2}$/.test(targetMonth)) {
      return res.status(400).json({ message: "Month must be in YYYY-MM format (e.g. 2026-10)." });
    }

    const [year, mon] = targetMonth.split("-").map(Number);
    const start = new Date(year, mon - 1, 1);
    const end = new Date(year, mon, 1);

    // 1. Fetch all budgets set by user for this month
    const budgets = await Budget.find({ user_id: req.userId, month: targetMonth }).sort({ category: 1 });

    // 2. Aggregate expenses for this user in this month grouped by category
    const expenseAgg = await Expense.aggregate([
      {
        $match: {
          user_id: new mongoose.Types.ObjectId(req.userId),
          date: { $gte: start, $lt: end },
        },
      },
      {
        $group: {
          _id: "$category",
          totalSpent: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
    ]);

    const spendingMap = {};
    let totalAllExpenses = 0;
    expenseAgg.forEach((item) => {
      spendingMap[item._id] = item.totalSpent;
      totalAllExpenses += item.totalSpent;
    });

    // 3. Match budgets with actual spending and generate alerts
    const alerts = [];
    let totalBudget = 0;
    let totalBudgetedSpent = 0;

    const items = budgets.map((b) => {
      const spent = spendingMap[b.category] || 0;
      const remaining = b.amount - spent;
      const percentage = b.amount > 0 ? Math.round((spent / b.amount) * 100) : 0;
      totalBudget += b.amount;
      totalBudgetedSpent += spent;

      let status = "ok"; // "ok" | "warning" | "exceeded"
      let alertMessage = null;

      if (spent > b.amount) {
        status = "exceeded";
        alertMessage = `🚨 ${b.category} budget exceeded! Spent ₹${spent.toLocaleString()} of ₹${b.amount.toLocaleString()} (Exceeded by ₹${(spent - b.amount).toLocaleString()})`;
        alerts.push({
          type: "danger",
          category: b.category,
          budget: b.amount,
          spent,
          remaining,
          percentage,
          message: alertMessage,
        });
      } else if (percentage >= 85) {
        status = "warning";
        alertMessage = `⚠️ You have used ${percentage}% of your ${b.category} budget (₹${spent.toLocaleString()} of ₹${b.amount.toLocaleString()})`;
        alerts.push({
          type: "warning",
          category: b.category,
          budget: b.amount,
          spent,
          remaining,
          percentage,
          message: alertMessage,
        });
      }

      return {
        _id: b._id,
        category: b.category,
        budget: b.amount,
        spent,
        remaining,
        percentage,
        status,
        month: b.month,
      };
    });

    // 4. Identify unbudgeted categories with expenses
    const budgetedCategories = new Set(budgets.map((b) => b.category));
    const unbudgetedCategories = expenseAgg
      .filter((item) => !budgetedCategories.has(item._id))
      .map((item) => ({
        category: item._id,
        spent: item.totalSpent,
        count: item.count,
      }));

    res.json({
      month: targetMonth,
      summary: {
        totalBudget,
        totalBudgetedSpent,
        totalAllExpenses,
        remaining: totalBudget - totalBudgetedSpent,
        percentage: totalBudget > 0 ? Math.round((totalBudgetedSpent / totalBudget) * 100) : 0,
        budgetCount: budgets.length,
      },
      budgets: items,
      alerts,
      unbudgetedCategories,
    });
  } catch (err) {
    res.status(500).json({ message: "Could not compute budget status.", error: err.message });
  }
});

module.exports = router;

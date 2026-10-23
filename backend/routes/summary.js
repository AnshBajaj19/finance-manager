const express = require("express");
const mongoose = require("mongoose");
const Income = require("../models/Income");
const Expense = require("../models/Expense");
const auth = require("../middleware/auth");
const { buildDateFilter } = require("../utils/dateRange");

const router = express.Router();

router.use(auth);

// GET /api/summary - income, expense and net totals for a period
// Example: /api/summary?month=2026-10
//          /api/summary?from=2026-10-01&to=2026-10-16
//          /api/summary            (no params = all time)
//
// The dashboard cards use this instead of adding up whatever list happens to be
// on screen, so they stay correct even when a category or search filter is active.
router.get("/", async (req, res) => {
  try {
    const { month, from, to } = req.query;

    const { filter, error } = buildDateFilter({ month, from, to });
    if (error) return res.status(400).json({ message: error });

    const match = { user_id: new mongoose.Types.ObjectId(req.userId) };
    if (filter) match.date = filter;

    const totals = [
      { $match: match },
      { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
    ];

    const [incomeAgg, expenseAgg] = await Promise.all([
      Income.aggregate(totals),
      Expense.aggregate(totals),
    ]);

    const totalIncome = incomeAgg[0]?.total || 0;
    const totalExpenses = expenseAgg[0]?.total || 0;

    res.json({
      totalIncome,
      incomeCount: incomeAgg[0]?.count || 0,
      totalExpenses,
      expenseCount: expenseAgg[0]?.count || 0,
      netBalance: totalIncome - totalExpenses,
    });
  } catch (err) {
    res.status(500).json({ message: "Could not compute summary.", error: err.message });
  }
});

module.exports = router;

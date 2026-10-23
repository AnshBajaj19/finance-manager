const express = require("express");
const Income = require("../models/Income");
const auth = require("../middleware/auth");
const { buildDateFilter, escapeRegex } = require("../utils/dateRange");

const router = express.Router();

// All income routes require a logged-in user
router.use(auth);

// POST /api/income - add new income
router.post("/", async (req, res) => {
  try {
    const { amount, source, date } = req.body;

    if (amount === undefined || !source) {
      return res.status(400).json({ message: "Amount and source are required." });
    }
    if (Number(amount) <= 0) {
      return res.status(400).json({ message: "Amount must be greater than 0." });
    }

    const income = await Income.create({
      user_id: req.userId,
      amount,
      source,
      date: date || Date.now(),
    });

    res.status(201).json(income);
  } catch (err) {
    res.status(500).json({ message: "Could not add income.", error: err.message });
  }
});

// GET /api/income - list income entries for the logged-in user
// Optional filters:
//   ?month=2026-10                      one calendar month
//   ?from=2026-10-01&to=2026-10-16      custom period (either end optional, "to" inclusive)
//   ?search=salary                      text match on the income source
router.get("/", async (req, res) => {
  try {
    const { month, from, to, search } = req.query;

    const { filter, error } = buildDateFilter({ month, from, to });
    if (error) return res.status(400).json({ message: error });

    const query = { user_id: req.userId };
    if (filter) query.date = filter;
    if (search && search.trim()) {
      query.source = { $regex: escapeRegex(search.trim()), $options: "i" };
    }

    const income = await Income.find(query).sort({ date: -1 });
    res.json(income);
  } catch (err) {
    res.status(500).json({ message: "Could not fetch income.", error: err.message });
  }
});

// PUT /api/income/:id - edit an income entry
router.put("/:id", async (req, res) => {
  try {
    const { amount, source, date } = req.body;

    const income = await Income.findOne({ _id: req.params.id, user_id: req.userId });
    if (!income) return res.status(404).json({ message: "Income entry not found." });

    if (amount !== undefined) income.amount = amount;
    if (source !== undefined) income.source = source;
    if (date !== undefined) income.date = date;

    await income.save();
    res.json(income);
  } catch (err) {
    res.status(500).json({ message: "Could not update income.", error: err.message });
  }
});

// DELETE /api/income/:id
router.delete("/:id", async (req, res) => {
  try {
    const income = await Income.findOneAndDelete({ _id: req.params.id, user_id: req.userId });
    if (!income) return res.status(404).json({ message: "Income entry not found." });
    res.json({ message: "Income entry deleted." });
  } catch (err) {
    res.status(500).json({ message: "Could not delete income.", error: err.message });
  }
});

module.exports = router;

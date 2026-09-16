const express = require("express");
const Expense = require("../models/Expense");
const auth = require("../middleware/auth");

const router = express.Router();

router.use(auth);

// POST /api/expense - add new expense
router.post("/", async (req, res) => {
  try {
    const { amount, description, category, payment_method, date } = req.body;

    if (amount === undefined || !description || !category || !payment_method) {
      return res.status(400).json({
        message: "Amount, description, category and payment method are required.",
      });
    }
    if (Number(amount) <= 0) {
      return res.status(400).json({ message: "Amount must be greater than 0." });
    }

    const expense = await Expense.create({
      user_id: req.userId,
      amount,
      description,
      category,
      payment_method,
      date: date || Date.now(),
    });

    res.status(201).json(expense);
  } catch (err) {
    if (err.name === "ValidationError") {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: "Could not add expense.", error: err.message });
  }
});

// GET /api/expense - list expenses, with optional category and month filters
// Example: /api/expense?category=Food&month=2026-08
router.get("/", async (req, res) => {
  try {
    const { category, month } = req.query;
    const query = { user_id: req.userId };

    if (category && category !== "All") {
      query.category = category;
    }

    if (month) {
      // month format: "YYYY-MM"
      const [year, mon] = month.split("-").map(Number);
      const start = new Date(year, mon - 1, 1);
      const end = new Date(year, mon, 1);
      query.date = { $gte: start, $lt: end };
    }

    const expenses = await Expense.find(query).sort({ date: -1 });
    res.json(expenses);
  } catch (err) {
    res.status(500).json({ message: "Could not fetch expenses.", error: err.message });
  }
});

// PUT /api/expense/:id - edit an expense
router.put("/:id", async (req, res) => {
  try {
    const { amount, description, category, payment_method, date } = req.body;

    const expense = await Expense.findOne({ _id: req.params.id, user_id: req.userId });
    if (!expense) return res.status(404).json({ message: "Expense not found." });

    if (amount !== undefined) expense.amount = amount;
    if (description !== undefined) expense.description = description;
    if (category !== undefined) expense.category = category;
    if (payment_method !== undefined) expense.payment_method = payment_method;
    if (date !== undefined) expense.date = date;

    await expense.save();
    res.json(expense);
  } catch (err) {
    if (err.name === "ValidationError") {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: "Could not update expense.", error: err.message });
  }
});

// DELETE /api/expense/:id
router.delete("/:id", async (req, res) => {
  try {
    const expense = await Expense.findOneAndDelete({ _id: req.params.id, user_id: req.userId });
    if (!expense) return res.status(404).json({ message: "Expense not found." });
    res.json({ message: "Expense deleted." });
  } catch (err) {
    res.status(500).json({ message: "Could not delete expense.", error: err.message });
  }
});

module.exports = router;

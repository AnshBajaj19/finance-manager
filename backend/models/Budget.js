const mongoose = require("mongoose");
const { CATEGORIES } = require("./Expense");

const BudgetSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    category: {
      type: String,
      required: true,
      enum: CATEGORIES,
    },
    amount: {
      type: Number,
      required: true,
      min: [1, "Budget amount must be greater than 0."],
    },
    month: {
      type: String, // Format "YYYY-MM" e.g. "2026-10"
      required: true,
      match: [/^\d{4}-\d{2}$/, "Month must be in YYYY-MM format."],
    },
  },
  { timestamps: true }
);

// Ensure a user can only have one budget per category per month
BudgetSchema.index({ user_id: 1, category: 1, month: 1 }, { unique: true });

module.exports = mongoose.model("Budget", BudgetSchema);

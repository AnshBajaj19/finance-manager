const mongoose = require("mongoose");

const AlertNotificationSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["unusual_expense", "budget_exceeded", "high_spending", "low_savings", "system"],
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    severity: {
      type: String,
      enum: ["warning", "danger", "info"],
      default: "warning",
    },
    expense_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Expense",
      default: null,
    },
    metadata: {
      amount: { type: Number },
      category: { type: String },
      description: { type: String },
      categoryAverage: { type: Number },
      multiplier: { type: Number },
      zScore: { type: Number },
      budgetAmount: { type: Number },
      percentageOfBudget: { type: Number },
    },
    is_read: {
      type: Boolean,
      default: false,
      index: true,
    },
    email_sent: {
      type: Boolean,
      default: false,
    },
    email_recipient: {
      type: String,
      default: "",
    },
    email_error: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("AlertNotification", AlertNotificationSchema);


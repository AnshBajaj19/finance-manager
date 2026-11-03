const mongoose = require("mongoose");

const InvestmentProfileSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    risk_tolerance: {
      type: String,
      enum: ["Low", "Medium", "High"],
      default: "Medium",
    },
    financial_goal: {
      type: String,
      enum: [
        "Wealth Creation",
        "Emergency Buffer",
        "Retirement",
        "Buying a Home",
        "Higher Education",
        "Short-term Goal",
        "Tax Saving",
      ],
      default: "Wealth Creation",
    },
    investment_horizon: {
      type: String,
      enum: [
        "Short Term (< 1-3 years)",
        "Medium Term (3-5 years)",
        "Long Term (5-10 years)",
        "Very Long Term (10+ years)",
      ],
      default: "Medium Term (3-5 years)",
    },
    monthly_investable_override: {
      type: Number,
      default: null,
      min: 0,
    },
    current_emergency_fund: {
      type: Number,
      default: 0,
      min: 0,
    },
    target_corpus: {
      type: Number,
      default: 0,
      min: 0,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("InvestmentProfile", InvestmentProfileSchema);


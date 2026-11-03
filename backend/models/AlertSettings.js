const mongoose = require("mongoose");

const AlertSettingsSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    email_alerts_enabled: {
      type: Boolean,
      default: true,
    },
    notify_unusual_expenses: {
      type: Boolean,
      default: true,
    },
    notify_budget_exceeded: {
      type: Boolean,
      default: true,
    },
    notify_high_spending: {
      type: Boolean,
      default: true,
    },
    anomaly_threshold_multiplier: {
      type: Number,
      default: 2.5,
      min: 1.5,
      max: 10.0,
    },
    z_score_threshold: {
      type: Number,
      default: 2.0,
      min: 1.0,
      max: 5.0,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("AlertSettings", AlertSettingsSchema);


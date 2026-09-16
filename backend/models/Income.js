const mongoose = require("mongoose");

const IncomeSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    source: { type: String, required: true, trim: true }, // e.g. "Salary", "Freelance"
    date: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Income", IncomeSchema);

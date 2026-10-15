const express = require("express");
const auth = require("../middleware/auth");
const { CATEGORIES } = require("../models/Expense");

const router = express.Router();

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://localhost:8000";

// Maps Flask ML service output labels to the official application CATEGORIES enum
const ML_TO_APP_CATEGORY_MAP = {
  "Food & Dining": "Food",
  "Travel & Commute": "Transport",
  "Shopping & Groceries": "Shopping",
  "Utilities & Bills": "Bills",
  "Entertainment & Leisure": "Entertainment",
  "Health & Medical": "Healthcare",
  "Education": "Education",
  "Investment & Savings": "Other",
};

// POST /api/categorize/suggest
// Body: { description: "Pizza from Domino's" }
// Forwards the description to the Python ML service and returns its predicted category.
router.post("/suggest", auth, async (req, res) => {
  try {
    const { description } = req.body;

    if (!description || !description.trim()) {
      return res.status(400).json({ message: "Description is required." });
    }

    const mlResponse = await fetch(`${ML_SERVICE_URL}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description }),
    });

    if (!mlResponse.ok) {
      const errBody = await mlResponse.json().catch(() => ({}));
      return res.status(mlResponse.status).json({
        message: errBody.error || "The categorization service could not process this request.",
      });
    }

    const result = await mlResponse.json();
    const rawCategory = result.category;
    // Map to valid enum; fallback to null if unrecognized
    const mappedCategory =
      ML_TO_APP_CATEGORY_MAP[rawCategory] ||
      (CATEGORIES.includes(rawCategory) ? rawCategory : null);

    res.json({
      category: mappedCategory,
      rawCategory,
      confidence: result.confidence,
    });
  } catch (err) {
    // Most common cause: the ML service (Flask, port 8000) isn't running
    res.status(503).json({
      message: "Could not reach the categorization service. Make sure the ML service is running.",
      error: err.message,
    });
  }
});

module.exports = router;
module.exports.ML_TO_APP_CATEGORY_MAP = ML_TO_APP_CATEGORY_MAP;

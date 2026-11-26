"""
app.py — ML Service for Dhan Drishti
Supports:
- Module 2: Automatic Expense Categorization (/predict)
- Module 4: Monthly Savings Prediction (/predict-savings, /savings-model-info)

Runs on http://localhost:8000 by default.
"""

import os
import re
import json
import joblib
import numpy as np
from sklearn.ensemble import IsolationForest
import pandas as pd
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # allow requests from the Node backend during local development

# ==========================================================
# MODULE 2: Expense Categorization Model Loading
# ==========================================================
try:
    category_model = joblib.load("model/category_model.pkl")
    vectorizer = joblib.load("model/vectorizer.pkl")
    CATEGORY_MODEL_LOADED = True
except FileNotFoundError:
    category_model = None
    vectorizer = None
    CATEGORY_MODEL_LOADED = False

# ==========================================================
# MODULE 4: Savings Prediction Model Loading
# ==========================================================
SAVINGS_FEATURE_NAMES = [
    "monthly_income",
    "total_expenses",
    "food_expenses",
    "transport_expenses",
    "shopping_expenses",
    "bills_expenses",
    "previous_savings",
    "month",
]

try:
    savings_model = joblib.load("model/savings_model.pkl")
    SAVINGS_MODEL_LOADED = True
except FileNotFoundError:
    savings_model = None
    SAVINGS_MODEL_LOADED = False

savings_model_metadata = None
if os.path.exists("model/savings_model_info.json"):
    try:
        with open("model/savings_model_info.json", "r") as f:
            savings_model_metadata = json.load(f)
    except Exception as e:
        print(f"Error loading savings model info: {e}")


def clean_text(text):
    text = text.lower()
    text = re.sub(r"[^a-z0-9\s]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "category_model_loaded": CATEGORY_MODEL_LOADED,
        "savings_model_loaded": SAVINGS_MODEL_LOADED,
    })


# ==========================================================
# MODULE 2 ENDPOINTS
# ==========================================================
@app.route("/predict", methods=["POST"])
def predict():
    if not CATEGORY_MODEL_LOADED:
        return jsonify({
            "error": "Category model not found. Run 'python train_model.py' first."
        }), 503

    data = request.get_json(silent=True) or {}
    description = data.get("description", "").strip()

    if not description:
        return jsonify({"error": "Please provide a non-empty 'description' field."}), 400

    cleaned = clean_text(description)
    vec = vectorizer.transform([cleaned])
    predicted_category = category_model.predict(vec)[0]

    confidence = None
    if hasattr(category_model, "predict_proba"):
        probs = category_model.predict_proba(vec)[0]
        confidence = round(float(max(probs)), 2)

    response = {"category": predicted_category}
    if confidence is not None:
        response["confidence"] = confidence

    return jsonify(response)


# ==========================================================
# MODULE 4 ENDPOINTS: Savings Prediction
# ==========================================================
@app.route("/predict-savings", methods=["POST"])
def predict_savings():
    if not SAVINGS_MODEL_LOADED:
        return jsonify({
            "error": "Savings prediction model not found. Run 'python train_savings_model.py' first."
        }), 503

    data = request.get_json(silent=True) or {}

    try:
        monthly_income = float(data.get("monthly_income", 0))
        total_expenses = float(data.get("total_expenses", 0))
        food_expenses = float(data.get("food_expenses", 0))
        transport_expenses = float(data.get("transport_expenses", 0))
        shopping_expenses = float(data.get("shopping_expenses", 0))
        bills_expenses = float(data.get("bills_expenses", 0))
        previous_savings = float(data.get("previous_savings", 0))
        month = int(data.get("month", datetime.now().month))
    except (ValueError, TypeError) as e:
        return jsonify({"error": f"Invalid numerical feature inputs: {str(e)}"}), 400

    # Ensure month is within 1-12
    month = max(1, min(12, month))

    features_dict = {
        "monthly_income": monthly_income,
        "total_expenses": total_expenses,
        "food_expenses": food_expenses,
        "transport_expenses": transport_expenses,
        "shopping_expenses": shopping_expenses,
        "bills_expenses": bills_expenses,
        "previous_savings": previous_savings,
        "month": month,
    }

    input_df = pd.DataFrame([features_dict])

    try:
        raw_prediction = float(savings_model.predict(input_df)[0])
        # Round prediction sensibly to nearest 50
        predicted_savings = round(raw_prediction / 50.0) * 50.0

        # Calculate savings rate
        savings_rate = 0.0
        if monthly_income > 0:
            savings_rate = round((predicted_savings / monthly_income) * 100.0, 1)

        # Categorize financial savings health status
        if savings_rate >= 25.0:
            status = "excellent"
            status_text = "Strong Savings Potential"
            insight = "Great financial health! You are consistently on track to save over 25% of your income."
        elif savings_rate >= 15.0:
            status = "healthy"
            status_text = "Good Savings Rate"
            insight = "Solid savings rate. Trimming non-essential discretionary expenses could increase this further."
        elif savings_rate >= 5.0:
            status = "moderate"
            status_text = "Moderate Savings"
            insight = "Your savings margin is narrow. Consider reviewing dining out and shopping budgets."
        elif savings_rate >= 0.0:
            status = "tight"
            status_text = "Tight Cash Flow"
            insight = "High expense ratio relative to income. Keep emergency buffer funds ready."
        else:
            status = "deficit"
            status_text = "Projected Deficit"
            insight = "Projected expenses exceed expected income. Immediate budget adjustments recommended."

        response = {
            "predicted_savings": predicted_savings,
            "monthly_income": monthly_income,
            "total_expenses": total_expenses,
            "savings_rate_percent": savings_rate,
            "status": status,
            "status_text": status_text,
            "insight": insight,
            "features_used": features_dict,
            "model_metadata": {
                "model_name": savings_model_metadata.get("best_model", "Regression Model") if savings_model_metadata else "Regression Model",
                "r2_score": savings_model_metadata.get("metrics", {}).get("r2", None) if savings_model_metadata else None,
                "mae": savings_model_metadata.get("metrics", {}).get("mae", None) if savings_model_metadata else None,
            }
        }

        return jsonify(response)

    except Exception as e:
        return jsonify({"error": f"Prediction computation failed: {str(e)}"}), 500


@app.route("/savings-model-info", methods=["GET"])
def get_savings_model_info():
    if not savings_model_metadata:
        return jsonify({
            "error": "Savings model info not available. Please run train_savings_model.py."
        }), 404

    return jsonify(savings_model_metadata)


# ==========================================================
# MODULE 7: Anomaly & Unusual Expense Detection
# (Rule-Based + Z-Score + Isolation Forest Outlier Analysis)
# ==========================================================
@app.route("/detect-anomaly", methods=["POST"])
def detect_anomaly():
    try:
        data = request.get_json() or {}
        amount = float(data.get("amount", 0))
        category = str(data.get("category", "General"))
        history = [float(x) for x in data.get("history", []) if x > 0]
        multiplier_threshold = float(data.get("multiplier_threshold", 2.5))
        z_threshold = float(data.get("z_threshold", 2.0))

        if not history:
            return jsonify({
                "is_anomaly": False,
                "category_average": amount,
                "multiplier": 1.0,
                "z_score": 0.0,
                "method": "insufficient_history",
                "reason": "Initial baseline entry."
            })

        mean_val = float(np.mean(history))
        std_val = float(np.std(history, ddof=1)) if len(history) > 1 else 0.0
        multiplier = round(amount / mean_val, 2) if mean_val > 0 else 1.0
        z_score = round(float((amount - mean_val) / std_val), 2) if std_val > 0 else 0.0

        is_anomaly = False
        method = "rule_threshold"
        reason = ""

        # Isolation Forest outlier check if sufficient sample size
        if len(history) >= 5:
            arr = np.array(history + [amount]).reshape(-1, 1)
            clf = IsolationForest(contamination=0.1, random_state=42)
            preds = clf.fit_predict(arr)
            is_if_outlier = (preds[-1] == -1)

            if is_if_outlier and (multiplier >= 2.0 or z_score >= 1.8):
                is_anomaly = True
                method = "isolation_forest"
                reason = f"Isolation Forest flagged ₹{amount:,.0f} as an outlier in {category} ({multiplier:.1f}x higher than average of ₹{mean_val:,.0f})."

        # Statistical Z-Score / Multiplier Check
        if not is_anomaly:
            if amount >= 500 and multiplier >= multiplier_threshold:
                is_anomaly = True
                method = "rule_multiplier"
                reason = f"Expense of ₹{amount:,.0f} is {multiplier:.1f}x higher than your typical {category} spending of ₹{mean_val:,.0f}."
            elif len(history) >= 3 and z_score >= z_threshold:
                is_anomaly = True
                method = "z_score_statistical"
                reason = f"Expense of ₹{amount:,.0f} exhibits high statistical outlier divergence (Z-Score: {z_score:.2f}) from typical {category} records."

        return jsonify({
            "is_anomaly": is_anomaly,
            "category_average": round(mean_val, 2),
            "multiplier": multiplier,
            "z_score": z_score,
            "method": method,
            "reason": reason
        })

    except Exception as e:
        return jsonify({"error": f"Anomaly detection failed: {str(e)}"}), 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    debug = os.environ.get("FLASK_DEBUG", "false").lower() == "true"
    app.run(host="0.0.0.0", port=port, debug=debug)

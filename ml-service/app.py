"""
app.py — Module 2: Expense Categorization API

A small Flask service that loads the trained model and vectorizer, then
exposes a /predict endpoint the Node backend calls whenever a user types
an expense description.

Run with: python app.py
Runs on http://localhost:8000 by default.
"""

import re
import joblib
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # allow requests from the Node backend during local development

# Load the trained model + vectorizer once at startup (not on every request)
try:
    model = joblib.load("model/category_model.pkl")
    vectorizer = joblib.load("model/vectorizer.pkl")
    MODEL_LOADED = True
except FileNotFoundError:
    model = None
    vectorizer = None
    MODEL_LOADED = False


def clean_text(text):
    text = text.lower()
    text = re.sub(r"[^a-z0-9\s]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "model_loaded": MODEL_LOADED})


@app.route("/predict", methods=["POST"])
def predict():
    if not MODEL_LOADED:
        return jsonify({
            "error": "Model not found. Run 'python train_model.py' first to train and save it."
        }), 503

    data = request.get_json(silent=True) or {}
    description = data.get("description", "").strip()

    if not description:
        return jsonify({"error": "Please provide a non-empty 'description' field."}), 400

    cleaned = clean_text(description)
    vec = vectorizer.transform([cleaned])
    predicted_category = model.predict(vec)[0]

    # Not every model (e.g. LinearSVC) supports predict_proba, so handle that gracefully
    confidence = None
    if hasattr(model, "predict_proba"):
        probs = model.predict_proba(vec)[0]
        confidence = round(float(max(probs)), 2)

    response = {"category": predicted_category}
    if confidence is not None:
        response["confidence"] = confidence

    return jsonify(response)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=True)

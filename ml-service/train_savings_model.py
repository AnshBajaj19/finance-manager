"""
train_savings_model.py — Module 4: Monthly Savings Prediction

Trains and compares 3 regression models (Linear Regression, Decision Tree Regressor,
and Random Forest Regressor) to predict monthly savings based on income,
expenses breakdown, historical savings, and month.

Evaluates each model using:
- MAE (Mean Absolute Error)
- RMSE (Root Mean Squared Error)
- R² Score (Coefficient of Determination)

Saves the best model to model/savings_model.pkl and evaluation summary
to model/savings_model_info.json.
"""

import os
import json
from datetime import datetime
import numpy as np
import pandas as pd
import joblib

from sklearn.model_selection import train_test_split
from sklearn.linear_model import LinearRegression
from sklearn.tree import DecisionTreeRegressor
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

from generate_savings_data import generate_dataset

FEATURE_NAMES = [
    "monthly_income",
    "total_expenses",
    "food_expenses",
    "transport_expenses",
    "shopping_expenses",
    "bills_expenses",
    "previous_savings",
    "month",
]


def load_or_create_data(csv_path="savings_dataset.csv"):
    if not os.path.exists(csv_path):
        print(f"Dataset not found at '{csv_path}'. Generating a new realistic dataset...")
        df = generate_dataset(num_samples=3000, random_state=42)
        df.to_csv(csv_path, index=False)
        print(f"Generated and saved dataset with {len(df)} samples.")
    else:
        df = pd.read_csv(csv_path)
    return df


def train_and_evaluate():
    os.makedirs("model", exist_ok=True)
    df = load_or_create_data("savings_dataset.csv")

    X = df[FEATURE_NAMES]
    y = df["actual_savings"]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )

    # Candidate models to evaluate
    candidate_pipelines = {
        "Linear Regression": Pipeline([
            ("scaler", StandardScaler()),
            ("regressor", LinearRegression()),
        ]),
        "Decision Tree Regression": Pipeline([
            ("regressor", DecisionTreeRegressor(max_depth=7, min_samples_split=6, random_state=42)),
        ]),
        "Random Forest Regression": Pipeline([
            ("regressor", RandomForestRegressor(n_estimators=120, max_depth=10, random_state=42, n_jobs=-1)),
        ]),
    }

    results = {}
    best_name = None
    best_pipeline = None
    best_r2 = -float("inf")

    print("=" * 65)
    print("Module 4: Savings Prediction Model Comparison")
    print("=" * 65)
    print(f"{'Model':<28} | {'MAE (INR)':<10} | {'RMSE (INR)':<10} | {'R2 Score':<10}")
    print("-" * 65)

    for name, pipeline in candidate_pipelines.items():
        pipeline.fit(X_train, y_train)
        y_pred = pipeline.predict(X_test)

        mae = float(mean_absolute_error(y_test, y_pred))
        rmse = float(np.sqrt(mean_squared_error(y_test, y_pred)))
        r2 = float(r2_score(y_test, y_pred))

        results[name] = {
            "name": name,
            "mae": round(mae, 2),
            "rmse": round(rmse, 2),
            "r2": round(r2, 4),
        }

        print(f"{name:<28} | {mae:<10.2f} | {rmse:<10.2f} | {r2:<10.4f}")

        if r2 > best_r2:
            best_r2 = r2
            best_name = name
            best_pipeline = pipeline

    print("=" * 65)
    print(f"Champion Model Selected: {best_name} with R2 = {best_r2:.4f}")
    print("=" * 65)

    # Retrain best pipeline on full dataset for maximum generalization
    best_pipeline.fit(X, y)

    # Save the champion model
    model_path = "model/savings_model.pkl"
    joblib.dump(best_pipeline, model_path)
    print(f"\nSaved champion model to '{model_path}'")

    # Sample demo prediction: Income Rs. 40,000, Prev Savings Rs. 9,000
    sample_features = {
        "monthly_income": 40000,
        "total_expenses": 30000,
        "food_expenses": 5000,
        "transport_expenses": 3000,
        "shopping_expenses": 4000,
        "bills_expenses": 6000,
        "previous_savings": 9000,
        "month": 10,
    }
    sample_df = pd.DataFrame([sample_features])
    sample_pred = float(best_pipeline.predict(sample_df)[0])
    sample_pred_rounded = round(sample_pred / 50.0) * 50.0

    print(f"\nSample Prediction Verification:")
    print(f"Input: {sample_features}")
    print(f"Predicted Savings: Rs. {sample_pred_rounded:,.2f}")

    # Save metadata info for the API and frontend
    info = {
        "best_model": best_name,
        "feature_names": FEATURE_NAMES,
        "metrics": results[best_name],
        "comparison": list(results.values()),
        "sample_verification": {
            "input": sample_features,
            "predicted_savings": sample_pred_rounded,
        },
        "trained_at": datetime.now().isoformat(),
        "training_samples": len(df),
    }

    info_path = "model/savings_model_info.json"
    with open(info_path, "w") as f:
        json.dump(info, f, indent=2)
    print(f"Saved evaluation metrics and metadata to '{info_path}'")


if __name__ == "__main__":
    train_and_evaluate()

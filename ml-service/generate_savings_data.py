"""
generate_savings_data.py — Generates synthetic training dataset for Module 4 (Savings Prediction).

Generates realistic monthly financial profiles covering diverse income tiers,
category expenditures, historical savings, seasonal effects (festival/vacation months),
and target actual savings.
"""

import numpy as np
import pandas as pd


def generate_dataset(num_samples=2500, random_state=42):
    np.random.seed(random_state)

    # 1. Monthly income across diverse brackets:
    # 35% low income (15,000 - 35,000)
    # 45% mid income (35,000 - 85,000)
    # 20% high income (85,000 - 180,000)
    bracket_choices = np.random.choice([1, 2, 3], size=num_samples, p=[0.35, 0.45, 0.20])
    incomes = []
    for b in bracket_choices:
        if b == 1:
            incomes.append(np.random.uniform(15000, 35000))
        elif b == 2:
            incomes.append(np.random.uniform(35000, 85000))
        else:
            incomes.append(np.random.uniform(85000, 180000))
    monthly_income = np.round(np.array(incomes), -2)

    # 2. Month (1 to 12)
    month = np.random.randint(1, 13, size=num_samples)

    # Seasonal spending multiplier:
    # Festival months (Oct, Nov: Diwali/Dussehra) & Dec (Year end holidays) ~ higher spending
    seasonal_multiplier = np.ones(num_samples)
    seasonal_multiplier[np.isin(month, [10, 11])] = np.random.uniform(1.08, 1.20, size=np.sum(np.isin(month, [10, 11])))
    seasonal_multiplier[month == 12] = np.random.uniform(1.05, 1.15, size=np.sum(month == 12))
    seasonal_multiplier[np.isin(month, [5, 6])] = np.random.uniform(1.03, 1.10, size=np.sum(np.isin(month, [5, 6]))) # summer

    # 3. Category Expenses as fractions of income with individual variances
    # Food: 12% - 25% of income
    food_ratio = np.random.uniform(0.12, 0.25, size=num_samples)
    food_expenses = np.round(monthly_income * food_ratio * seasonal_multiplier, -1)

    # Transport: 5% - 14% of income
    transport_ratio = np.random.uniform(0.05, 0.14, size=num_samples)
    transport_expenses = np.round(monthly_income * transport_ratio, -1)

    # Shopping: 6% - 22% of income (strongly affected by seasonality)
    shopping_ratio = np.random.uniform(0.06, 0.20, size=num_samples)
    shopping_expenses = np.round(monthly_income * shopping_ratio * seasonal_multiplier, -1)

    # Bills: 10% - 22% of income (utilities, rent contribution, subscriptions)
    bills_ratio = np.random.uniform(0.10, 0.22, size=num_samples)
    bills_expenses = np.round(monthly_income * bills_ratio, -1)

    # Other misc expenses: 3% - 10% of income
    other_ratio = np.random.uniform(0.03, 0.10, size=num_samples)
    other_expenses = np.round(monthly_income * other_ratio, -1)

    # Total expenses
    total_expenses = food_expenses + transport_expenses + shopping_expenses + bills_expenses + other_expenses

    # Ensure total_expenses doesn't unrealistically exceed income for all normal cases,
    # but allow occasional negative/tight cash flow
    cap_mask = total_expenses > (monthly_income * 1.05)
    total_expenses[cap_mask] = np.round(monthly_income[cap_mask] * np.random.uniform(0.85, 0.98, size=np.sum(cap_mask)), -1)

    # 4. Previous savings: habitual savings habit of user
    # Typically 15% - 35% of monthly income with slight noise
    base_savings_rate = np.random.uniform(0.15, 0.35, size=num_samples)
    previous_savings = np.round(monthly_income * base_savings_rate + np.random.normal(0, 1000, size=num_samples), -1)
    previous_savings = np.maximum(previous_savings, 0)

    # 5. Actual savings (Target variable):
    # Base calculation is (Income - Total Expenses).
    # Real-world behavioral factors:
    # - Users with high previous savings discipline retain an additional 5-10% of surplus.
    # - Unplanned micro-expenses and small cash leakages reduce surplus by 3-8%.
    # - Small random cashbacks or unexpected costs (+/- standard deviation).
    unplanned_leakage = np.random.uniform(0.02, 0.06, size=num_samples) * monthly_income
    habit_bonus = (previous_savings / (monthly_income + 1e-5)) * 0.08 * monthly_income
    noise = np.random.normal(0, 500, size=num_samples)

    actual_savings = (monthly_income - total_expenses) - unplanned_leakage + habit_bonus + noise
    # Round to nearest 50
    actual_savings = np.round(actual_savings / 50.0) * 50.0

    df = pd.DataFrame({
        "monthly_income": monthly_income,
        "total_expenses": total_expenses,
        "food_expenses": food_expenses,
        "transport_expenses": transport_expenses,
        "shopping_expenses": shopping_expenses,
        "bills_expenses": bills_expenses,
        "previous_savings": previous_savings,
        "month": month,
        "actual_savings": actual_savings,
    })

    return df


if __name__ == "__main__":
    df = generate_dataset()
    output_path = "savings_dataset.csv"
    df.to_csv(output_path, index=False)
    print(f"Dataset generated successfully with {len(df)} samples saved to {output_path}")
    print("\nDataset Summary Preview:")
    print(df.describe().round(1))

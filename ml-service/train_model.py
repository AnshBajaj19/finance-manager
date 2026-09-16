"""
train_model.py — Module 2: Automatic Expense Categorization

Trains a TF-IDF + Logistic Regression classifier that predicts an expense
category from its text description, then saves the trained model and
vectorizer to disk so the Flask API (app.py) can load and serve them.

Run this once whenever you update dataset.csv:
    python train_model.py
"""

import re
import joblib
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report
from sklearn.naive_bayes import MultinomialNB
from sklearn.svm import LinearSVC


def clean_text(text):
    """Lowercase and strip punctuation/extra whitespace from a description."""
    text = text.lower()
    text = re.sub(r"[^a-z0-9\s]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def main():
    # Step 1 — Load dataset
    df = pd.read_csv("dataset.csv")
    df["clean_description"] = df["description"].apply(clean_text)

    X = df["clean_description"]
    y = df["category"]

    # Step 2 — Split into train/test so we can honestly evaluate accuracy
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    # Step 3 — Vectorize text with TF-IDF
    vectorizer = TfidfVectorizer(ngram_range=(1, 2), min_df=1)
    X_train_vec = vectorizer.fit_transform(X_train)
    X_test_vec = vectorizer.transform(X_test)

    # Step 4 — Compare a few candidate models (useful to mention/screenshot in your report)
    candidates = {
        "Logistic Regression": LogisticRegression(max_iter=1000),
        "Naive Bayes": MultinomialNB(),
        "Linear SVM": LinearSVC(),
    }

    best_name, best_model, best_acc = None, None, -1
    print("Model comparison on held-out test set:\n")
    for name, model in candidates.items():
        model.fit(X_train_vec, y_train)
        preds = model.predict(X_test_vec)
        acc = accuracy_score(y_test, preds)
        print(f"  {name}: accuracy = {acc:.2f}")
        if acc > best_acc:
            best_name, best_model, best_acc = name, model, acc

    print(f"\nBest model: {best_name} (accuracy = {best_acc:.2f})")
    print("\nDetailed report for best model:")
    print(classification_report(y_test, best_model.predict(X_test_vec)))

    # Step 5 — Retrain the best model on ALL data before saving (more training data = better predictions)
    X_all_vec = vectorizer.fit_transform(X)
    best_model.fit(X_all_vec, y)

    # Step 6 — Save model + vectorizer for the Flask API to load
    joblib.dump(best_model, "model/category_model.pkl")
    joblib.dump(vectorizer, "model/vectorizer.pkl")

    with open("model/model_info.txt", "w") as f:
        f.write(f"Best model: {best_name}\n")
        f.write(f"Test accuracy: {best_acc:.2f}\n")
        f.write(f"Categories: {sorted(y.unique())}\n")

    print("\nSaved model/category_model.pkl and model/vectorizer.pkl")
    print("You can now run: python app.py")


if __name__ == "__main__":
    main()

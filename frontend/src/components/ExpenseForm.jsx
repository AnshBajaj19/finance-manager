import { useState, useEffect, useRef } from "react";
import { addExpense, CATEGORIES, PAYMENT_METHODS } from "../api/expense";
import { suggestCategory } from "../api/categorize";

export default function ExpenseForm({ onAdded }) {
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_METHODS[0]);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // Module 2 — ML category suggestion
  const [suggestion, setSuggestion] = useState(null); // { category, confidence }
  const [categoryTouched, setCategoryTouched] = useState(false); // true once user picks manually
  const debounceRef = useRef(null);

  // Whenever the description changes, wait 500ms after typing stops, then ask the ML service
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!description.trim() || description.trim().length < 3) {
      setSuggestion(null);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      try {
        const result = await suggestCategory(description);
        // Only accept the suggestion if it matches a valid category in our dropdown
        if (result && result.category && CATEGORIES.includes(result.category)) {
          setSuggestion(result);
          // Only auto-fill the category dropdown if the user hasn't manually changed it yet
          if (!categoryTouched) {
            setCategory(result.category);
          }
        } else {
          // If prediction is unknown or invalid, do not overwrite; keep user's current selection as safe fallback
          setSuggestion(null);
        }
      } catch (err) {
        // Fails silently in the UI — the user can still pick a category manually.
        // Most likely cause: the Python ML service isn't running.
        setSuggestion(null);
      }
    }, 500);

    return () => clearTimeout(debounceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [description]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (Number(amount) <= 0) {
      setError("Amount must be greater than 0.");
      return;
    }

    setSaving(true);
    try {
      await addExpense({
        amount: Number(amount),
        description,
        category,
        payment_method: paymentMethod,
        date,
      });
      setAmount("");
      setDescription("");
      setCategory(CATEGORIES[0]);
      setCategoryTouched(false);
      setSuggestion(null);
      onAdded();
    } catch (err) {
      setError(err.response?.data?.message || "Could not add expense.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="inline-form" onSubmit={handleSubmit}>
      <h3>Add Expense</h3>
      {error && <div className="error-banner">{error}</div>}
      <div className="form-row">
        <input
          type="number"
          placeholder="Amount (₹)"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          min="0.01"
          step="0.01"
          required
        />
        <input
          type="text"
          placeholder="Description (e.g. Uber ride)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
        />
        <select
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            setCategoryTouched(true);
          }}
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
          {PAYMENT_METHODS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        <button type="submit" disabled={saving}>
          {saving ? "Adding..." : "Add Expense"}
        </button>
      </div>

      {suggestion && (
        <p className="ml-suggestion">
          Suggested category: <strong>{suggestion.category}</strong>
          {suggestion.confidence != null && ` (${Math.round(suggestion.confidence * 100)}% confidence)`}
          {categoryTouched && category !== suggestion.category && (
            <button
              type="button"
              className="secondary suggestion-apply-btn"
              onClick={() => {
                setCategory(suggestion.category);
                setCategoryTouched(false);
              }}
            >
              Use this
            </button>
          )}
        </p>
      )}
    </form>
  );
}

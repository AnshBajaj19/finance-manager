import { useState } from "react";
import { addIncome } from "../api/income";

export default function IncomeForm({ onAdded }) {
  const [amount, setAmount] = useState("");
  const [source, setSource] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (Number(amount) <= 0) {
      setError("Amount must be greater than 0.");
      return;
    }

    setSaving(true);
    try {
      await addIncome({ amount: Number(amount), source, date });
      setAmount("");
      setSource("");
      onAdded();
    } catch (err) {
      setError(err.response?.data?.message || "Could not add income.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="inline-form" onSubmit={handleSubmit}>
      <h3>Add Income</h3>
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
          placeholder="Source (e.g. Salary)"
          value={source}
          onChange={(e) => setSource(e.target.value)}
          required
        />
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        <button type="submit" disabled={saving}>
          {saving ? "Adding..." : "Add Income"}
        </button>
      </div>
    </form>
  );
}

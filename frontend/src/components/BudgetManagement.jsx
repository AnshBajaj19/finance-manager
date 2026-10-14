import { useState } from "react";
import { setBudget, updateBudget, deleteBudget } from "../api/budget";
import { CATEGORIES } from "../api/expense";

export default function BudgetManagement({
  budgetStatus,
  selectedMonth,
  setSelectedMonth,
  onBudgetChanged,
}) {
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [amount, setAmount] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editAmount, setEditAmount] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const currentMonthStr = new Date().toISOString().slice(0, 7);

  const handleSetBudget = async (e) => {
    e.preventDefault();
    setError("");

    if (Number(amount) <= 0) {
      setError("Budget amount must be greater than 0.");
      return;
    }

    setSaving(true);
    try {
      await setBudget({
        category,
        amount: Number(amount),
        month: selectedMonth,
      });
      setAmount("");
      onBudgetChanged();
    } catch (err) {
      setError(err.response?.data?.message || "Could not save budget.");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (item) => {
    setEditingId(item._id);
    setEditAmount(item.budget);
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const handleSaveEdit = async (id) => {
    if (Number(editAmount) <= 0) {
      alert("Budget amount must be greater than 0.");
      return;
    }
    try {
      await updateBudget(id, { amount: Number(editAmount) });
      setEditingId(null);
      onBudgetChanged();
    } catch (err) {
      alert(err.response?.data?.message || "Could not update budget.");
    }
  };

  const handleDelete = async (id, catName) => {
    if (!window.confirm(`Delete budget for ${catName}?`)) return;
    try {
      await deleteBudget(id);
      onBudgetChanged();
    } catch (err) {
      alert(err.response?.data?.message || "Could not delete budget.");
    }
  };

  const handleQuickAdd = (cat) => {
    setCategory(cat);
    // Focus amount input
    const el = document.getElementById("budget-amount-input");
    if (el) el.focus();
  };

  const summary = budgetStatus?.summary || {
    totalBudget: 0,
    totalBudgetedSpent: 0,
    remaining: 0,
    percentage: 0,
  };

  const budgets = budgetStatus?.budgets || [];
  const unbudgeted = budgetStatus?.unbudgetedCategories || [];

  return (
    <div>
      <div className="budget-header-bar">
        <div>
          <h3>Monthly Budget Tracking</h3>
          <p className="subtitle" style={{ margin: 0 }}>
            Set category limits, monitor real-time spending, and track threshold alerts.
          </p>
        </div>

        <div className="budget-month-picker">
          <label>Month:</label>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
          />
          {selectedMonth !== currentMonthStr && (
            <button
              className="secondary"
              style={{ fontSize: "12px", padding: "6px 10px" }}
              onClick={() => setSelectedMonth(currentMonthStr)}
            >
              Current Month
            </button>
          )}
        </div>
      </div>

      {/* Overview Cards for selected month */}
      <div className="summary-cards" style={{ marginBottom: "20px" }}>
        <div className="card">
          <span className="card-label">Total Budget ({selectedMonth})</span>
          <span className="card-value" style={{ color: "var(--primary)" }}>
            ₹{summary.totalBudget.toLocaleString()}
          </span>
        </div>
        <div className="card">
          <span className="card-label">Budgeted Spending</span>
          <span className="card-value expense">
            ₹{summary.totalBudgetedSpent.toLocaleString()}
          </span>
        </div>
        <div className="card">
          <span className="card-label">Remaining Budget</span>
          <span
            className="card-value"
            style={{ color: summary.remaining >= 0 ? "#16a34a" : "var(--danger)" }}
          >
            {summary.remaining >= 0 ? `₹${summary.remaining.toLocaleString()}` : `-₹${Math.abs(summary.remaining).toLocaleString()}`}
          </span>
        </div>
      </div>

      {/* Set / Update Budget Form */}
      <form className="inline-form" onSubmit={handleSetBudget}>
        <h4>Set Category Budget</h4>
        {error && <div className="error-banner">{error}</div>}
        <div className="form-row">
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <input
            id="budget-amount-input"
            type="number"
            placeholder="Monthly Budget (₹) e.g. 5000"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            min="1"
            step="1"
            required
          />
          <button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save Budget"}
          </button>
        </div>
      </form>

      {/* Category Budgets Grid */}
      <div>
        <h4>Category Budgets ({budgets.length})</h4>
        {budgets.length === 0 ? (
          <p className="empty-state">
            No budgets set for {selectedMonth}. Add your first category budget above!
          </p>
        ) : (
          <div className="budget-cards-grid">
            {budgets.map((item) => {
              const isOver = item.status === "exceeded";
              const isWarning = item.status === "warning";
              const borderClass = isOver
                ? "border-danger"
                : isWarning
                ? "border-warning"
                : "";

              return (
                <div key={item._id} className={`budget-card-item ${borderClass}`}>
                  <div>
                    <div className="budget-card-top">
                      <h5 className="budget-category-title">{item.category}</h5>
                      <span className={`status-pill ${item.status}`}>
                        {isOver ? "Exceeded" : isWarning ? `${item.percentage}% Used` : "On Track"}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="budget-progress-track">
                      <div
                        className={`budget-progress-thumb ${item.status}`}
                        style={{ width: `${Math.min(item.percentage, 100)}%` }}
                      />
                    </div>

                    {/* Numbers: Budget vs Spent */}
                    <div className="budget-numbers-row">
                      <span>
                        Spent: <strong>₹{item.spent.toLocaleString()}</strong>
                      </span>
                      <span>
                        Budget: <strong>₹{item.budget.toLocaleString()}</strong>
                      </span>
                    </div>

                    <div className={`budget-remaining-text ${item.status}`}>
                      {item.remaining >= 0
                        ? `₹${item.remaining.toLocaleString()} remaining`
                        : `Exceeded by ₹${Math.abs(item.remaining).toLocaleString()}`}
                    </div>
                  </div>

                  {/* Actions / Inline Edit */}
                  <div className="budget-actions-row">
                    {editingId === item._id ? (
                      <>
                        <input
                          type="number"
                          value={editAmount}
                          onChange={(e) => setEditAmount(e.target.value)}
                          style={{ width: "90px", padding: "4px 8px" }}
                          min="1"
                        />
                        <button onClick={() => handleSaveEdit(item._id)}>Save</button>
                        <button onClick={cancelEdit} className="secondary">
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => startEdit(item)}
                          className="secondary"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(item._id, item.category)}
                          className="danger"
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Unbudgeted categories with expenses */}
      {unbudgeted.length > 0 && (
        <div className="unbudgeted-section">
          <strong>Categories with spending but no budget set for {selectedMonth}:</strong>
          <div className="unbudgeted-chips">
            {unbudgeted.map((u) => (
              <div key={u.category} className="unbudgeted-chip">
                <span>
                  {u.category}: ₹{u.spent.toLocaleString()}
                </span>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => handleQuickAdd(u.category)}
                >
                  + Set Budget
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

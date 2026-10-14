import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { getIncome } from "../api/income";
import { getExpenses } from "../api/expense";
import { getBudgetStatus } from "../api/budget";
import IncomeForm from "../components/IncomeForm.jsx";
import IncomeList from "../components/IncomeList.jsx";
import ExpenseForm from "../components/ExpenseForm.jsx";
import ExpenseList from "../components/ExpenseList.jsx";
import BudgetManagement from "../components/BudgetManagement.jsx";
import BudgetAlerts from "../components/BudgetAlerts.jsx";

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [income, setIncome] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [filterCategory, setFilterCategory] = useState("All");
  const [filterMonth, setFilterMonth] = useState("");
  const [loading, setLoading] = useState(true);

  // Module 3 - Budget Management State
  const [activeTab, setActiveTab] = useState("transactions"); // "transactions" | "budgets"
  const [budgetMonth, setBudgetMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [budgetStatus, setBudgetStatus] = useState(null);

  const navigate = useNavigate();

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (stored) setUser(JSON.parse(stored));
  }, []);

  const loadIncome = useCallback(async () => {
    try {
      const data = await getIncome();
      setIncome(data);
    } catch (err) {
      console.error("Failed to load income:", err);
    }
  }, []);

  const loadBudget = useCallback(async () => {
    try {
      const data = await getBudgetStatus(budgetMonth);
      setBudgetStatus(data);
    } catch (err) {
      console.error("Failed to load budget status:", err);
    }
  }, [budgetMonth]);

  const loadExpenses = useCallback(async () => {
    try {
      const data = await getExpenses({
        category: filterCategory !== "All" ? filterCategory : undefined,
        month: filterMonth || undefined,
      });
      setExpenses(data);
      // Keep budget data in sync whenever expenses change
      loadBudget();
    } catch (err) {
      console.error("Failed to load expenses:", err);
    }
  }, [filterCategory, filterMonth, loadBudget]);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadIncome(), loadExpenses(), loadBudget()]).finally(() =>
      setLoading(false)
    );
  }, [loadIncome, loadExpenses, loadBudget]);

  const totalIncome = income.reduce((sum, i) => sum + i.amount, 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  const activeAlerts = budgetStatus?.alerts || [];
  const budgetSummary = budgetStatus?.summary;

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div>
          <h1>Finance Manager</h1>
          {user && <p className="subtitle">Welcome back, {user.name}</p>}
        </div>
        <button onClick={handleLogout} className="secondary">
          Logout
        </button>
      </header>

      {/* Top Level Summary Cards */}
      <section className="summary-cards">
        <div className="card">
          <span className="card-label">Total Income</span>
          <span className="card-value income">₹{totalIncome.toLocaleString()}</span>
        </div>
        <div className="card">
          <span className="card-label">Total Expenses</span>
          <span className="card-value expense">₹{totalExpenses.toLocaleString()}</span>
        </div>
        <div className="card">
          <span className="card-label">Net Balance</span>
          <span className="card-value">₹{(totalIncome - totalExpenses).toLocaleString()}</span>
        </div>
        {budgetSummary && budgetSummary.budgetCount > 0 && (
          <div className="card">
            <span className="card-label">Monthly Budget ({budgetMonth})</span>
            <span
              className="card-value"
              style={{
                color: budgetSummary.remaining >= 0 ? "var(--primary)" : "var(--danger)",
                fontSize: "20px",
              }}
            >
              ₹{budgetSummary.totalBudgetedSpent.toLocaleString()} / ₹{budgetSummary.totalBudget.toLocaleString()}
            </span>
            <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
              {budgetSummary.percentage}% spent ({budgetSummary.remaining >= 0 ? `₹${budgetSummary.remaining.toLocaleString()} left` : `Exceeded by ₹${Math.abs(budgetSummary.remaining).toLocaleString()}`})
            </span>
          </div>
        )}
      </section>

      {/* Module 3 — Real-Time Budget Alerts (Always Visible If Triggered) */}
      <BudgetAlerts
        alerts={activeAlerts}
        onNavigateToBudget={() => setActiveTab("budgets")}
      />

      {/* Navigation Tabs */}
      <div className="dashboard-nav-tabs">
        <button
          className={`tab-nav-btn ${activeTab === "transactions" ? "active" : ""}`}
          onClick={() => setActiveTab("transactions")}
        >
          💳 Transactions (Income & Expenses)
        </button>
        <button
          className={`tab-nav-btn ${activeTab === "budgets" ? "active" : ""}`}
          onClick={() => setActiveTab("budgets")}
        >
          🎯 Budget Management (Module 3)
          {activeAlerts.length > 0 && (
            <span className="alert-counter-badge">{activeAlerts.length}</span>
          )}
        </button>
      </div>

      {loading ? (
        <p>Loading your data...</p>
      ) : activeTab === "transactions" ? (
        <>
          <section className="panel">
            <IncomeForm onAdded={loadIncome} />
            <IncomeList income={income} onChanged={loadIncome} />
          </section>

          <section className="panel">
            <ExpenseForm onAdded={loadExpenses} />
            <ExpenseList
              expenses={expenses}
              filterCategory={filterCategory}
              setFilterCategory={setFilterCategory}
              filterMonth={filterMonth}
              setFilterMonth={setFilterMonth}
              onChanged={loadExpenses}
            />
          </section>
        </>
      ) : (
        <section className="panel">
          <BudgetManagement
            budgetStatus={budgetStatus}
            selectedMonth={budgetMonth}
            setSelectedMonth={setBudgetMonth}
            onBudgetChanged={loadBudget}
          />
        </section>
      )}
    </div>
  );
}

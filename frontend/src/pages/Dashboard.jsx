import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { getIncome } from "../api/income";
import { getExpenses } from "../api/expense";
import { getSummary } from "../api/summary";
import { getBudgetStatus } from "../api/budget";
import IncomeForm from "../components/IncomeForm.jsx";
import IncomeList from "../components/IncomeList.jsx";
import ExpenseForm from "../components/ExpenseForm.jsx";
import ExpenseList from "../components/ExpenseList.jsx";
import BudgetManagement from "../components/BudgetManagement.jsx";
import BudgetAlerts from "../components/BudgetAlerts.jsx";
import SavingsPrediction from "../components/SavingsPrediction.jsx";
import FinancialHealth from "../components/FinancialHealth.jsx";
import PeriodFilter from "../components/PeriodFilter.jsx";
import { currentMonth, getPeriodParams, getPeriodLabel } from "../utils/period";

const money = (n) => (n < 0 ? `-₹${Math.abs(n).toLocaleString()}` : `₹${n.toLocaleString()}`);
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [income, setIncome] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [summary, setSummary] = useState({
    totalIncome: 0,
    incomeCount: 0,
    totalExpenses: 0,
    expenseCount: 0,
    netBalance: 0,
  });
  const [filterCategory, setFilterCategory] = useState("All");
  const [loading, setLoading] = useState(true);

  // Period selector: one choice that controls the cards, the income list and the expense list.
  // Defaults to the current month so the cards show what was earned/spent THIS month.
  const [period, setPeriod] = useState({ mode: "month", month: currentMonth(), from: "", to: "" });
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Navigation tab state: "transactions" | "budgets" | "savings" | "health"
  const [activeTab, setActiveTab] = useState("transactions");
  const [budgetMonth, setBudgetMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [budgetStatus, setBudgetStatus] = useState(null);

  const navigate = useNavigate();

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (stored) setUser(JSON.parse(stored));
  }, []);

  // Wait until the user stops typing before searching
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  const { params: periodParams, error: periodError } = useMemo(() => getPeriodParams(period), [period]);
  const periodLabel = getPeriodLabel(period);

  // Ignore responses that arrive after a newer request was already made
  const requestIds = useRef({ income: 0, expenses: 0, summary: 0 });

  const loadIncome = useCallback(async () => {
    if (periodError) return;
    const id = ++requestIds.current.income;
    try {
      const data = await getIncome({ ...periodParams, search: debouncedSearch || undefined });
      if (id === requestIds.current.income) setIncome(data);
    } catch (err) {
      console.error("Failed to load income:", err);
    }
  }, [periodParams, periodError, debouncedSearch]);

  const loadSummary = useCallback(async () => {
    if (periodError) return;
    const id = ++requestIds.current.summary;
    try {
      const data = await getSummary(periodParams);
      if (id === requestIds.current.summary) setSummary(data);
    } catch (err) {
      console.error("Failed to load summary:", err);
    }
  }, [periodParams, periodError]);

  const loadBudget = useCallback(async () => {
    try {
      const data = await getBudgetStatus(budgetMonth);
      setBudgetStatus(data);
    } catch (err) {
      console.error("Failed to load budget status:", err);
    }
  }, [budgetMonth]);

  const loadExpenses = useCallback(async () => {
    if (periodError) return;
    const id = ++requestIds.current.expenses;
    try {
      const data = await getExpenses({
        ...periodParams,
        category: filterCategory !== "All" ? filterCategory : undefined,
        search: debouncedSearch || undefined,
      });
      if (id === requestIds.current.expenses) setExpenses(data);
      // Keep budget data in sync whenever expenses change
      loadBudget();
    } catch (err) {
      console.error("Failed to load expenses:", err);
    }
  }, [periodParams, periodError, filterCategory, debouncedSearch, loadBudget]);

  // Used by the forms/lists after an add, edit or delete: refresh the list AND the cards
  const refreshIncome = useCallback(
    () => Promise.all([loadIncome(), loadSummary()]),
    [loadIncome, loadSummary]
  );
  const refreshExpenses = useCallback(
    () => Promise.all([loadExpenses(), loadSummary()]),
    [loadExpenses, loadSummary]
  );

  // Initial load, and again whenever the period / search / category changes
  useEffect(() => {
    Promise.all([loadIncome(), loadExpenses(), loadSummary(), loadBudget()]).finally(() =>
      setLoading(false)
    );
  }, [loadIncome, loadExpenses, loadSummary, loadBudget]);

  const incomeShown = income.reduce((sum, i) => sum + i.amount, 0);
  const expensesShown = expenses.reduce((sum, e) => sum + e.amount, 0);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  const activeAlerts = budgetStatus?.alerts || [];
  const budgetSummary = budgetStatus?.summary;

  const searchNote = debouncedSearch ? ` matching “${debouncedSearch}”` : "";
  const categoryNote = filterCategory !== "All" ? ` in ${filterCategory}` : "";

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

      {/* Period + search: controls the cards and both lists below */}
      <PeriodFilter period={period} setPeriod={setPeriod} search={search} setSearch={setSearch} />

      {/* Top Level Summary Cards (totals for the selected period) */}
      <section className="summary-cards">
        <div className="card">
          <span className="card-label">Income · {periodLabel}</span>
          <span className="card-value income">{money(summary.totalIncome)}</span>
          <span className="card-sub">{plural(summary.incomeCount, "entry", "entries")}</span>
        </div>
        <div className="card">
          <span className="card-label">Expenses · {periodLabel}</span>
          <span className="card-value expense">{money(summary.totalExpenses)}</span>
          <span className="card-sub">{plural(summary.expenseCount, "entry", "entries")}</span>
        </div>
        <div className="card">
          <span className="card-label">Net Balance · {periodLabel}</span>
          <span
            className="card-value"
            style={{ color: summary.netBalance < 0 ? "var(--danger)" : undefined }}
          >
            {money(summary.netBalance)}
          </span>
          <span className="card-sub">Income − Expenses</span>
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
        <button
          className={`tab-nav-btn ${activeTab === "savings" ? "active" : ""}`}
          onClick={() => setActiveTab("savings")}
        >
          💰 Savings Prediction (Module 4)
        </button>
        <button
          className={`tab-nav-btn ${activeTab === "health" ? "active" : ""}`}
          onClick={() => setActiveTab("health")}
        >
          🏥 Financial Health (Module 5)
        </button>
      </div>

      {loading ? (
        <p>Loading your data...</p>
      ) : activeTab === "transactions" ? (
        <>
          <section className="panel">
            <IncomeForm onAdded={refreshIncome} />
            <p className="results-caption">
              <strong>Income</strong> · {periodLabel}
              {searchNote}: {plural(income.length, "entry", "entries")}, total{" "}
              <strong>{money(incomeShown)}</strong>
            </p>
            <IncomeList income={income} onChanged={refreshIncome} />
          </section>

          <section className="panel">
            <ExpenseForm onAdded={refreshExpenses} />
            <p className="results-caption">
              <strong>Expenses</strong> · {periodLabel}
              {categoryNote}
              {searchNote}: {plural(expenses.length, "entry", "entries")}, total{" "}
              <strong>{money(expensesShown)}</strong>
            </p>
            <ExpenseList
              expenses={expenses}
              filterCategory={filterCategory}
              setFilterCategory={setFilterCategory}
              onChanged={refreshExpenses}
            />
          </section>
        </>
      ) : activeTab === "budgets" ? (
        <section className="panel">
          <BudgetManagement
            budgetStatus={budgetStatus}
            selectedMonth={budgetMonth}
            setSelectedMonth={setBudgetMonth}
            onBudgetChanged={loadBudget}
          />
        </section>
      ) : activeTab === "savings" ? (
        <section className="panel">
          <SavingsPrediction currentMonth={period.month || budgetMonth} />
        </section>
      ) : (
        <section className="panel">
          <FinancialHealth
            currentMonth={period.month || budgetMonth}
            onNavigateToBudget={() => setActiveTab("budgets")}
          />
        </section>
      )}
    </div>
  );
}

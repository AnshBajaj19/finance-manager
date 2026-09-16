import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { getIncome } from "../api/income";
import { getExpenses } from "../api/expense";
import IncomeForm from "../components/IncomeForm.jsx";
import IncomeList from "../components/IncomeList.jsx";
import ExpenseForm from "../components/ExpenseForm.jsx";
import ExpenseList from "../components/ExpenseList.jsx";

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [income, setIncome] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [filterCategory, setFilterCategory] = useState("All");
  const [filterMonth, setFilterMonth] = useState("");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (stored) setUser(JSON.parse(stored));
  }, []);

  const loadIncome = useCallback(async () => {
    const data = await getIncome();
    setIncome(data);
  }, []);

  const loadExpenses = useCallback(async () => {
    const data = await getExpenses({
      category: filterCategory !== "All" ? filterCategory : undefined,
      month: filterMonth || undefined,
    });
    setExpenses(data);
  }, [filterCategory, filterMonth]);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadIncome(), loadExpenses()]).finally(() => setLoading(false));
  }, [loadIncome, loadExpenses]);

  const totalIncome = income.reduce((sum, i) => sum + i.amount, 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

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
      </section>

      {loading ? (
        <p>Loading your data...</p>
      ) : (
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
      )}
    </div>
  );
}

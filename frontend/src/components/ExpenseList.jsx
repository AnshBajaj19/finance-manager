import { useState } from "react";
import { updateExpense, deleteExpense, CATEGORIES } from "../api/expense";

export default function ExpenseList({ expenses, filterCategory, setFilterCategory, filterMonth, setFilterMonth, onChanged }) {
  const [editingId, setEditingId] = useState(null);
  const [editAmount, setEditAmount] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editCategory, setEditCategory] = useState("");

  const startEdit = (item) => {
    setEditingId(item._id);
    setEditAmount(item.amount);
    setEditDescription(item.description);
    setEditCategory(item.category);
  };

  const cancelEdit = () => setEditingId(null);

  const saveEdit = async (id) => {
    await updateExpense(id, {
      amount: Number(editAmount),
      description: editDescription,
      category: editCategory,
    });
    setEditingId(null);
    onChanged();
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this expense?")) return;
    await deleteExpense(id);
    onChanged();
  };

  return (
    <div>
      <div className="filters">
        <label>
          Category:{" "}
          <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
            <option value="All">All</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label>
          Month:{" "}
          <input type="month" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} />
        </label>
        {(filterCategory !== "All" || filterMonth) && (
          <button
            className="secondary"
            onClick={() => {
              setFilterCategory("All");
              setFilterMonth("");
            }}
          >
            Clear filters
          </button>
        )}
      </div>

      {expenses.length === 0 ? (
        <p className="empty-state">No expenses match your filters.</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Amount</th>
              <th>Description</th>
              <th>Category</th>
              <th>Payment</th>
              <th>Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((item) => (
              <tr key={item._id}>
                {editingId === item._id ? (
                  <>
                    <td>
                      <input
                        type="number"
                        value={editAmount}
                        onChange={(e) => setEditAmount(e.target.value)}
                        style={{ width: "80px" }}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                      />
                    </td>
                    <td>
                      <select value={editCategory} onChange={(e) => setEditCategory(e.target.value)}>
                        {CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>{item.payment_method}</td>
                    <td>{new Date(item.date).toLocaleDateString()}</td>
                    <td>
                      <button onClick={() => saveEdit(item._id)}>Save</button>
                      <button onClick={cancelEdit} className="secondary">
                        Cancel
                      </button>
                    </td>
                  </>
                ) : (
                  <>
                    <td>₹{item.amount.toLocaleString()}</td>
                    <td>{item.description}</td>
                    <td>
                      <span className="badge">{item.category}</span>
                    </td>
                    <td>{item.payment_method}</td>
                    <td>{new Date(item.date).toLocaleDateString()}</td>
                    <td>
                      <button onClick={() => startEdit(item)} className="secondary">
                        Edit
                      </button>
                      <button onClick={() => handleDelete(item._id)} className="danger">
                        Delete
                      </button>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

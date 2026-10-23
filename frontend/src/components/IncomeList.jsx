import { useState } from "react";
import { updateIncome, deleteIncome } from "../api/income";

export default function IncomeList({ income, onChanged }) {
  const [editingId, setEditingId] = useState(null);
  const [editAmount, setEditAmount] = useState("");
  const [editSource, setEditSource] = useState("");

  const startEdit = (item) => {
    setEditingId(item._id);
    setEditAmount(item.amount);
    setEditSource(item.source);
  };

  const cancelEdit = () => setEditingId(null);

  const saveEdit = async (id) => {
    await updateIncome(id, { amount: Number(editAmount), source: editSource });
    setEditingId(null);
    onChanged();
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this income entry?")) return;
    await deleteIncome(id);
    onChanged();
  };

  if (income.length === 0) {
    return <p className="empty-state">No income found for this period.</p>;
  }

  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>Amount</th>
          <th>Source</th>
          <th>Date</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {income.map((item) => (
          <tr key={item._id}>
            {editingId === item._id ? (
              <>
                <td>
                  <input
                    type="number"
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                    style={{ width: "90px" }}
                  />
                </td>
                <td>
                  <input type="text" value={editSource} onChange={(e) => setEditSource(e.target.value)} />
                </td>
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
                <td>{item.source}</td>
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
  );
}

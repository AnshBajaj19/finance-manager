import client from "./client";

export const addExpense = (data) => client.post("/expense", data).then((res) => res.data);

export const getExpenses = (filters = {}) =>
  client.get("/expense", { params: filters }).then((res) => res.data);

export const updateExpense = (id, data) => client.put(`/expense/${id}`, data).then((res) => res.data);
export const deleteExpense = (id) => client.delete(`/expense/${id}`).then((res) => res.data);

export const CATEGORIES = [
  "Food",
  "Transport",
  "Shopping",
  "Bills",
  "Entertainment",
  "Healthcare",
  "Education",
  "Rent/Housing",
  "Other",
];

export const PAYMENT_METHODS = ["Cash", "UPI", "Card", "Net Banking", "Other"];

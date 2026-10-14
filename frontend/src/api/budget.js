import client from "./client";

export const getBudgets = (month) =>
  client.get("/budget", { params: month ? { month } : {} }).then((res) => res.data);

export const getBudgetStatus = (month) =>
  client.get("/budget/status", { params: month ? { month } : {} }).then((res) => res.data);

export const setBudget = (data) =>
  client.post("/budget", data).then((res) => res.data);

export const updateBudget = (id, data) =>
  client.put(`/budget/${id}`, data).then((res) => res.data);

export const deleteBudget = (id) =>
  client.delete(`/budget/${id}`).then((res) => res.data);

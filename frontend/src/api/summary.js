import client from "./client";

// Income / expense / net totals for a period (same params as getIncome / getExpenses)
export const getSummary = (filters = {}) =>
  client.get("/summary", { params: filters }).then((res) => res.data);

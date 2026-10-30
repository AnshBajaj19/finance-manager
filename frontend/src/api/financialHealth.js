import client from "./client";

export const getFinancialHealth = (month) =>
  client.get("/financial-health", { params: { month } }).then((res) => res.data);

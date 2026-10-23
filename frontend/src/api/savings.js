import client from "./client";

export const getSavingsPrediction = (month) =>
  client.get("/savings/predict", { params: { month } }).then((res) => res.data);

export const simulateSavings = (payload) =>
  client.post("/savings/simulate", payload).then((res) => res.data);

export const getSavingsHistory = () =>
  client.get("/savings/history").then((res) => res.data);

export const getSavingsModelInfo = () =>
  client.get("/savings/model-info").then((res) => res.data);

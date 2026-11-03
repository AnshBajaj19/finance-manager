import client from "./client";

export const getInvestmentProfile = (month) =>
  client.get("/investment/profile", { params: { month } }).then((res) => res.data);

export const saveInvestmentProfile = (payload) =>
  client.post("/investment/profile", payload).then((res) => res.data);

export const getInvestmentRecommendations = (payload) =>
  client.post("/investment/recommend", payload).then((res) => res.data);

export const calculateSipProjection = (payload) =>
  client.post("/investment/calculate-sip", payload).then((res) => res.data);


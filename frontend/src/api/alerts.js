import client from "./client";

export const getAlerts = (params = {}) =>
  client.get("/alerts", { params }).then((res) => res.data);

export const getUnreadAlertCount = () =>
  client.get("/alerts/unread-count").then((res) => res.data);

export const markAlertAsRead = (id) =>
  client.put(`/alerts/${id}/read`).then((res) => res.data);

export const markAllAlertsAsRead = () =>
  client.put("/alerts/read-all").then((res) => res.data);

export const deleteAlert = (id) =>
  client.delete(`/alerts/${id}`).then((res) => res.data);

export const scanAnomalies = () =>
  client.get("/alerts/anomalies").then((res) => res.data);

export const getAlertSettings = () =>
  client.get("/alerts/settings").then((res) => res.data);

export const updateAlertSettings = (payload) =>
  client.put("/alerts/settings", payload).then((res) => res.data);

export const sendTestEmailAlert = () =>
  client.post("/alerts/test-email").then((res) => res.data);

export const simulateAnomaly = (payload) =>
  client.post("/alerts/test-simulation", payload).then((res) => res.data);

export const getEmailLogs = () =>
  client.get("/alerts/email-logs").then((res) => res.data);


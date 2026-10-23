import client from "./client";

export const addIncome = (data) => client.post("/income", data).then((res) => res.data);

// filters: { month } or { from, to }, plus optional { search }
export const getIncome = (filters = {}) =>
  client.get("/income", { params: filters }).then((res) => res.data);

export const updateIncome = (id, data) => client.put(`/income/${id}`, data).then((res) => res.data);
export const deleteIncome = (id) => client.delete(`/income/${id}`).then((res) => res.data);

import client from "./client";

export const addIncome = (data) => client.post("/income", data).then((res) => res.data);
export const getIncome = () => client.get("/income").then((res) => res.data);
export const updateIncome = (id, data) => client.put(`/income/${id}`, data).then((res) => res.data);
export const deleteIncome = (id) => client.delete(`/income/${id}`).then((res) => res.data);

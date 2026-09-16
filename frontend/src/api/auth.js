import client from "./client";

export const signup = (name, email, password) =>
  client.post("/auth/signup", { name, email, password }).then((res) => res.data);

export const login = (email, password) =>
  client.post("/auth/login", { email, password }).then((res) => res.data);

export const getProfile = () => client.get("/auth/me").then((res) => res.data);

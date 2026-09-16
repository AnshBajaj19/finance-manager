import client from "./client";

// Ask the ML service (via the Node backend) what category a description likely belongs to.
export const suggestCategory = (description) =>
  client.post("/categorize/suggest", { description }).then((res) => res.data);

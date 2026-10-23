// Helpers for the dashboard's "period" selector (month / date range / all time).
// All dates here are LOCAL calendar dates written as "YYYY-MM-DD" or "YYYY-MM".

const pad = (n) => String(n).padStart(2, "0");

export const toISODate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const currentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
};

// shiftMonth("2026-10", -1) -> "2026-09"
export const shiftMonth = (month, delta) => {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
};

// Last N days including today
export const lastNDays = (n) => {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - (n - 1));
  return { from: toISODate(from), to: toISODate(to) };
};

export const yearToDate = () => {
  const to = new Date();
  return { from: `${to.getFullYear()}-01-01`, to: toISODate(to) };
};

const parseLocalDay = (s) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};

const formatDay = (s) =>
  parseLocalDay(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

// Turns the period state into query params for the API, plus a validation error if any.
// period = { mode: "month" | "range" | "all", month: "YYYY-MM", from: "YYYY-MM-DD", to: "YYYY-MM-DD" }
export function getPeriodParams(period) {
  if (period.mode === "month") {
    return { params: period.month ? { month: period.month } : {}, error: null };
  }

  if (period.mode === "range") {
    const { from, to } = period;
    if (from && to && from > to) {
      return { params: {}, error: "The 'From' date must be on or before the 'To' date." };
    }
    const params = {};
    if (from) params.from = from;
    if (to) params.to = to;
    return { params, error: null };
  }

  return { params: {}, error: null }; // all time
}

// Human-readable label, e.g. "October 2026" or "01 Oct 2026 – 16 Oct 2026"
export function getPeriodLabel(period) {
  if (period.mode === "month" && period.month) {
    const [y, m] = period.month.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  }

  if (period.mode === "range") {
    const { from, to } = period;
    if (from && to) return `${formatDay(from)} – ${formatDay(to)}`;
    if (from) return `From ${formatDay(from)}`;
    if (to) return `Until ${formatDay(to)}`;
  }

  return "All time";
}

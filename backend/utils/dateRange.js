// Shared helpers for filtering income / expenses by a time period.
//
// Dates are saved from <input type="date"> as "YYYY-MM-DD", which MongoDB
// stores as UTC midnight. So all period boundaries here are computed in UTC
// to match exactly, regardless of the server's own timezone.

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function parseDay(str) {
  if (!DAY_RE.test(str)) return null;
  const [y, m, d] = str.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  // Reject impossible dates such as 2026-02-31
  if (date.getUTCMonth() !== m - 1) return null;
  return date;
}

// Accepts { month: "YYYY-MM" } OR { from: "YYYY-MM-DD", to: "YYYY-MM-DD" }
// (either end of a range may be left out). The "to" day is inclusive.
// Returns { filter } where filter is a Mongo date condition (or null for "all time"),
// or { error } with a message that is safe to show the user.
function buildDateFilter({ month, from, to } = {}) {
  if (month) {
    if (!MONTH_RE.test(month)) {
      return { error: "Month must be in YYYY-MM format." };
    }
    const [y, m] = month.split("-").map(Number);
    return {
      filter: {
        $gte: new Date(Date.UTC(y, m - 1, 1)),
        $lt: new Date(Date.UTC(y, m, 1)),
      },
    };
  }

  if (from || to) {
    const filter = {};

    if (from) {
      const start = parseDay(from);
      if (!start) return { error: "'from' must be a valid date in YYYY-MM-DD format." };
      filter.$gte = start;
    }
    if (to) {
      const end = parseDay(to);
      if (!end) return { error: "'to' must be a valid date in YYYY-MM-DD format." };
      filter.$lt = new Date(end.getTime() + ONE_DAY_MS); // include the whole "to" day
    }
    if (filter.$gte && filter.$lt && filter.$gte >= filter.$lt) {
      return { error: "The 'from' date must be on or before the 'to' date." };
    }
    return { filter };
  }

  return { filter: null };
}

// Makes user-typed search text safe to use inside a MongoDB $regex.
function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

module.exports = { buildDateFilter, escapeRegex };

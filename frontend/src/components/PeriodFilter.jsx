import {
  currentMonth,
  shiftMonth,
  lastNDays,
  yearToDate,
  getPeriodParams,
  getPeriodLabel,
} from "../utils/period";

const MODES = [
  { id: "month", label: "Month" },
  { id: "range", label: "Date range" },
  { id: "all", label: "All time" },
];

export default function PeriodFilter({ period, setPeriod, search, setSearch }) {
  const { error } = getPeriodParams(period);
  const label = getPeriodLabel(period);
  const thisMonth = currentMonth();

  const switchMode = (mode) => {
    if (mode === "range" && !period.from && !period.to) {
      // Start with something useful instead of an empty range
      setPeriod({ ...period, mode, ...lastNDays(30) });
    } else if (mode === "month" && !period.month) {
      setPeriod({ ...period, mode, month: thisMonth });
    } else {
      setPeriod({ ...period, mode });
    }
  };

  const setRange = ({ from, to }) => setPeriod({ ...period, mode: "range", from, to });

  return (
    <section className="period-filter">
      <div className="period-filter-top">
        <div className="period-modes">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              className={`period-mode-btn ${period.mode === m.id ? "active" : ""}`}
              onClick={() => switchMode(m.id)}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="period-search">
          <input
            type="text"
            placeholder="Search income source or expense description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button type="button" className="period-search-clear" onClick={() => setSearch("")} aria-label="Clear search">
              ×
            </button>
          )}
        </div>
      </div>

      <div className="period-controls">
        {period.mode === "month" && (
          <>
            <button
              type="button"
              className="secondary period-step"
              onClick={() => setPeriod({ ...period, month: shiftMonth(period.month || thisMonth, -1) })}
              aria-label="Previous month"
            >
              ‹
            </button>
            <input
              type="month"
              value={period.month}
              onChange={(e) => setPeriod({ ...period, month: e.target.value })}
            />
            <button
              type="button"
              className="secondary period-step"
              onClick={() => setPeriod({ ...period, month: shiftMonth(period.month || thisMonth, 1) })}
              aria-label="Next month"
            >
              ›
            </button>
            {period.month !== thisMonth && (
              <button type="button" className="secondary" onClick={() => setPeriod({ ...period, month: thisMonth })}>
                This month
              </button>
            )}
          </>
        )}

        {period.mode === "range" && (
          <>
            <label className="period-field">
              From
              <input
                type="date"
                value={period.from}
                max={period.to || undefined}
                onChange={(e) => setPeriod({ ...period, from: e.target.value })}
              />
            </label>
            <label className="period-field">
              To
              <input
                type="date"
                value={period.to}
                min={period.from || undefined}
                onChange={(e) => setPeriod({ ...period, to: e.target.value })}
              />
            </label>
            <span className="period-presets">
              <button type="button" className="secondary" onClick={() => setRange(lastNDays(7))}>
                Last 7 days
              </button>
              <button type="button" className="secondary" onClick={() => setRange(lastNDays(30))}>
                Last 30 days
              </button>
              <button type="button" className="secondary" onClick={() => setRange(lastNDays(90))}>
                Last 90 days
              </button>
              <button type="button" className="secondary" onClick={() => setRange(yearToDate())}>
                This year
              </button>
            </span>
          </>
        )}

        {period.mode === "all" && (
          <span className="period-hint">Showing every entry you have recorded.</span>
        )}
      </div>

      {error ? (
        <div className="error-banner" style={{ marginTop: 10, marginBottom: 0 }}>
          {error}
        </div>
      ) : (
        <p className="period-showing">
          Showing: <strong>{label}</strong>
        </p>
      )}
    </section>
  );
}

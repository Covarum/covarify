"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  CURRENT_PERIODS,
  HISTORICAL_PERIODS,
  RECENT_PERIODS,
  formatFinancialPeriodDateRange,
  type ResolvedFinancialPeriod,
} from "@/lib/financial-periods";
import styles from "./money-picture.module.css";

export function FinancialPeriodSelector({
  period,
  financialEventCount,
}: {
  period: ResolvedFinancialPeriod;
  financialEventCount: number;
}) {
  const router = useRouter();
  const [start, setStart] = useState(
    period.key === "custom" ? period.start : "",
  );
  const [end, setEnd] = useState(period.key === "custom" ? period.end : "");
  const [error, setError] = useState("");

  const choose = (key: string) => {
    setError("");
    router.push(`/account?period=${encodeURIComponent(key)}`);
  };
  const applyCustom = () => {
    if (!start || !end || start > end) {
      setError("Choose a valid start and end date.");
      return;
    }
    setError("");
    router.push(
      `/account?period=custom&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,
    );
  };
  const periodQuery = new URLSearchParams({ period: period.key });
  if (period.key === "custom") {
    periodQuery.set("start", period.start);
    periodQuery.set("end", period.end);
  }

  return (
    <section className={styles.periodSelector} aria-labelledby="period-heading">
      <header>
        <div>
          <p>Time intelligence</p>
          <h2 id="period-heading">Choose the period you want to understand</h2>
        </div>
        <strong>
          {period.label}: {formatFinancialPeriodDateRange(period)}
        </strong>
        <Link href={`/account/events/review?${periodQuery.toString()}`}>
          Review {financialEventCount} Financial Event
          {financialEventCount === 1 ? "" : "s"} in this period
        </Link>
      </header>
      <div className={styles.periodGroups}>
        <fieldset>
          <legend>Current</legend>
          <div>
            {CURRENT_PERIODS.map(([key, label]) => (
              <button
                key={key}
                type="button"
                aria-pressed={period.key === key}
                onClick={() => choose(key)}
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>Recent</legend>
          <div>
            {RECENT_PERIODS.map(([key, label]) => (
              <button
                key={key}
                type="button"
                aria-pressed={period.key === key}
                onClick={() => choose(key)}
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>Historical</legend>
          <div>
            {HISTORICAL_PERIODS.map(([key, label]) => (
              <button key={key} type="button" aria-pressed={period.key === key} onClick={() => choose(key)}>
                {label}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>Custom</legend>
          <div className={styles.customPeriod}>
            <label>
              Start date
              <input
                type="date"
                value={start}
                max={end || period.end}
                onChange={(event) => setStart(event.target.value)}
              />
            </label>
            <label>
              End date
              <input
                type="date"
                value={end}
                min={start}
                max={period.asOf}
                onChange={(event) => setEnd(event.target.value)}
              />
            </label>
            <button type="button" onClick={applyCustom}>
              Apply custom date range
            </button>
          </div>
          {error && <p role="alert">{error}</p>}
        </fieldset>
      </div>
    </section>
  );
}

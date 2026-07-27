export const CURRENT_PERIODS = [
  ["this-month", "This month"],
  ["this-quarter", "This quarter"],
  ["year-to-date", "Year to date"],
] as const;

export const RECENT_PERIODS = [
  ["last-30-days", "Last 30 days"],
  ["last-60-days", "Last 60 days"],
  ["last-90-days", "Last 90 days"],
  ["last-6-months", "Last 6 months"],
  ["last-12-months", "Last 12 months"],
] as const;

export const HISTORICAL_PERIODS = [
  ["last-month", "Last month"],
  ["last-quarter", "Last quarter"],
  ["last-calendar-year", "Last calendar year"],
] as const;

export type FinancialPeriodKey =
  | (typeof CURRENT_PERIODS)[number][0]
  | (typeof RECENT_PERIODS)[number][0]
  | (typeof HISTORICAL_PERIODS)[number][0]
  | "custom";

export type FinancialPeriodSelection = {
  key: FinancialPeriodKey;
  start?: string;
  end?: string;
};

export type ResolvedFinancialPeriod = {
  key: FinancialPeriodKey;
  label: string;
  start: string;
  end: string;
  priorStart: string;
  priorEnd: string;
  asOf: string;
  futureKind: "preset" | "custom";
};

const DAY = 86_400_000;
const iso = (date: Date) => date.toISOString().slice(0, 10);
const utcDay = (date: Date) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
const addDays = (date: Date, days: number) =>
  new Date(date.getTime() + days * DAY);
const startOfMonth = (date: Date) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
const endOfMonth = (date: Date) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
const rollingMonthStart = (date: Date, monthsBack: number) => {
  const targetMonth = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - monthsBack, 1),
  );
  const lastDay = endOfMonth(targetMonth).getUTCDate();
  return new Date(
    Date.UTC(
      targetMonth.getUTCFullYear(),
      targetMonth.getUTCMonth(),
      Math.min(date.getUTCDate() + 1, lastDay),
    ),
  );
};
const startOfQuarter = (date: Date) =>
  new Date(
    Date.UTC(
      date.getUTCFullYear(),
      Math.floor(date.getUTCMonth() / 3) * 3,
      1,
    ),
  );
const validIsoDate = (value?: string) =>
  Boolean(
    value &&
      /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      iso(new Date(`${value}T00:00:00Z`)) === value,
  );

function labelFor(key: FinancialPeriodKey) {
  return [...CURRENT_PERIODS, ...RECENT_PERIODS, ...HISTORICAL_PERIODS].find(
    ([candidate]) => candidate === key,
  )?.[1] || "Custom period";
}

export function parseFinancialPeriodSelection(
  input: Record<string, string | string[] | undefined>,
): FinancialPeriodSelection {
  const requested = Array.isArray(input.period) ? input.period[0] : input.period;
  const known = [...CURRENT_PERIODS, ...RECENT_PERIODS, ...HISTORICAL_PERIODS].some(
    ([key]) => key === requested,
  );
  if (requested === "custom") {
    return {
      key: "custom",
      start: Array.isArray(input.start) ? input.start[0] : input.start,
      end: Array.isArray(input.end) ? input.end[0] : input.end,
    };
  }
  return { key: known ? (requested as FinancialPeriodKey) : "this-month" };
}

export function resolveFinancialPeriod(
  selection: FinancialPeriodSelection,
  now = new Date(),
): ResolvedFinancialPeriod {
  const today = utcDay(now);
  let start: Date;
  let end = today;

  switch (selection.key) {
    case "last-60-days":
      start = addDays(today, -59);
      break;
    case "last-90-days":
      start = addDays(today, -89);
      break;
    case "last-6-months":
      start = rollingMonthStart(today, 6);
      break;
    case "last-12-months":
      start = rollingMonthStart(today, 12);
      break;
    case "this-month":
      start = startOfMonth(today);
      break;
    case "last-month":
      start = new Date(
        Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1),
      );
      end = endOfMonth(start);
      break;
    case "this-quarter":
      start = startOfQuarter(today);
      break;
    case "last-quarter": {
      end = addDays(startOfQuarter(today), -1);
      start = startOfQuarter(end);
      break;
    }
    case "year-to-date":
      start = new Date(Date.UTC(today.getUTCFullYear(), 0, 1));
      break;
    case "last-calendar-year":
      start = new Date(Date.UTC(today.getUTCFullYear() - 1, 0, 1));
      end = new Date(Date.UTC(today.getUTCFullYear() - 1, 11, 31));
      break;
    case "custom": {
      if (!validIsoDate(selection.start) || !validIsoDate(selection.end)) {
        throw new Error("INVALID_CUSTOM_PERIOD");
      }
      start = new Date(`${selection.start}T00:00:00Z`);
      end = new Date(`${selection.end}T00:00:00Z`);
      if (start > end || end > today) throw new Error("INVALID_CUSTOM_PERIOD");
      break;
    }
    default:
      start = addDays(today, -29);
  }

  const durationDays = Math.round((end.getTime() - start.getTime()) / DAY) + 1;
  let priorEnd = addDays(start, -1);
  let priorStart = addDays(priorEnd, -(durationDays - 1));
  if (selection.key === "this-month") {
    priorStart = startOfMonth(priorEnd);
    priorEnd = new Date(
      Date.UTC(
        priorStart.getUTCFullYear(),
        priorStart.getUTCMonth(),
        Math.min(today.getUTCDate(), endOfMonth(priorStart).getUTCDate()),
      ),
    );
  } else if (selection.key === "last-month") {
    priorEnd = addDays(start, -1);
    priorStart = startOfMonth(priorEnd);
  } else if (selection.key === "this-quarter") {
    priorEnd = addDays(start, -1);
    priorStart = startOfQuarter(priorEnd);
    priorEnd = addDays(priorStart, durationDays - 1);
  } else if (selection.key === "last-quarter") {
    priorEnd = addDays(start, -1);
    priorStart = startOfQuarter(priorEnd);
  } else if (selection.key === "year-to-date") {
    priorStart = new Date(Date.UTC(today.getUTCFullYear() - 1, 0, 1));
    priorEnd = new Date(
      Date.UTC(
        today.getUTCFullYear() - 1,
        today.getUTCMonth(),
        Math.min(today.getUTCDate(), endOfMonth(new Date(Date.UTC(today.getUTCFullYear() - 1, today.getUTCMonth(), 1))).getUTCDate()),
      ),
    );
  } else if (selection.key === "last-calendar-year") {
    priorStart = new Date(Date.UTC(start.getUTCFullYear() - 1, 0, 1));
    priorEnd = new Date(Date.UTC(start.getUTCFullYear() - 1, 11, 31));
  }
  return {
    key: selection.key,
    label: labelFor(selection.key),
    start: iso(start),
    end: iso(end),
    priorStart: iso(priorStart),
    priorEnd: iso(priorEnd),
    asOf: iso(today),
    futureKind: selection.key === "custom" ? "custom" : "preset",
  };
}

export function formatFinancialPeriodDateRange(
  period: Pick<ResolvedFinancialPeriod, "start" | "end">,
) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
  return `${formatter.format(new Date(`${period.start}T00:00:00Z`))} through ${formatter.format(new Date(`${period.end}T00:00:00Z`))}`;
}

export function transactionInPeriod(
  date: string,
  period: Pick<ResolvedFinancialPeriod, "start" | "end">,
) {
  return date >= period.start && date <= period.end;
}

/**
 * Future Financial Periods ("Since last paycheck", "Since vacation", etc.)
 * should resolve into this same start/end contract. Add a futureKind of
 * "financial-event" plus a stable event reference; downstream engines must
 * continue consuming only the resolved canonical period.
 */

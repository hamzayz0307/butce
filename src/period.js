// Budget periods. A period is one budget "month" that starts on the user's chosen
// day (e.g. payday on the 15th: 15 Oct – 14 Nov). It is keyed and named by the calendar
// month holding most of its days: start day 15 → "October" is 15 Oct – 14 Nov,
// start day 25 → "November" is 25 Oct – 24 Nov. Start day 1 gives calendar months.
import { state } from './state.js';
import { pad, today, shiftDays, addMonths, daysInMonth, daysBetween, parseYmd } from './utils.js';
import { monthName, dateShort } from './format.js';

export const MAX_START_DAY = 28; // every month has a 28th

export const startDay = () => Math.min(MAX_START_DAY, Math.max(1, Math.round(Number(state.settings.period_start_day) || 1)));

// Late start days belong to the following month's budget
const lead = () => (startDay() > 16 ? 1 : 0);

export const periodStart = key => `${addMonths(key, -lead())}-${pad(startDay())}`;
export const periodEnd = key => shiftDays(periodStart(addMonths(key, 1)), -1);
export const periodLength = key => daysBetween(periodStart(key), periodEnd(key)) + 1;

// Which period a 'YYYY-MM-DD' date belongs to
export function periodOf(date) {
  const k = date.slice(0, 7);
  const startMonth = Number(date.slice(8, 10)) >= startDay() ? k : addMonths(k, -1);
  return addMonths(startMonth, lead());
}

export const curPeriod = () => periodOf(today());
export const inPeriod = (date, key) => date >= periodStart(key) && date <= periodEnd(key);

// 1 on the first day of the period
export const dayInPeriod = (date, key) => daysBetween(periodStart(key), date) + 1;

// The date inside period `key` for something due on day `day` (1–31) of every month.
// Days before the start day fall in the period's second calendar month.
export function dueInPeriod(day, key) {
  const startMonth = addMonths(key, -lead());
  const k = day >= startDay() ? startMonth : addMonths(startMonth, 1);
  return `${k}-${pad(Math.min(day, daysInMonth(k)))}`;
}

// "Ekim 2026", or for payday periods "Ekim 2026" plus a range "15 Eki – 14 Kas"
export const periodTitle = key => monthName(key);
export function periodRange(key) {
  if (startDay() === 1) return '';
  const s = periodStart(key), e = periodEnd(key);
  const yr = parseYmd(e).getFullYear() !== parseYmd(s).getFullYear() ? ` ${parseYmd(e).getFullYear()}` : '';
  return `${dateShort(s)} – ${dateShort(e)}${yr}`;
}

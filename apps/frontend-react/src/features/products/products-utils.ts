import type { DayMap, DateProducts } from './types';

export function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function getWeekDays(startDate: Date): Date[] {
  const days: Date[] = [];
  const start = new Date(startDate);
  const dayOfWeek = start.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  start.setDate(start.getDate() + mondayOffset);
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    days.push(d);
  }
  return days;
}

export function isToday(date: Date): boolean {
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

/** Flatten the API response array into a single date map */
export function flattenProducts(products: DayMap[]): Record<string, DateProducts> {
  const result: Record<string, DateProducts> = {};
  for (const dayMap of products) {
    for (const [date, hours] of Object.entries(dayMap)) {
      result[date] = hours;
    }
  }
  return result;
}

/** Get unique hours from all days, sorted */
export function getUniqueHours(flatMap: Record<string, DateProducts>): string[] {
  const hours = new Set<string>();
  for (const dateProducts of Object.values(flatMap)) {
    for (const hour of Object.keys(dateProducts)) {
      hours.add(hour);
    }
  }
  return Array.from(hours).sort();
}

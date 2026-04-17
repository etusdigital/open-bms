import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * Converte um timestamp UTC do backend (scheduleTo, createdAt, etc.)
 * para string 'YYYY-MM-DD' no timezone da conta.
 */
export function formatDateTz(date: string | Date, tz: string): string {
  return dayjs.utc(date).tz(tz).format('YYYY-MM-DD');
}

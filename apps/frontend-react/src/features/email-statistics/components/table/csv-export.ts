import type { StatisticsTableRow } from '../../types';

function escapeCell(value: unknown): string {
  const str = value == null ? '' : String(value);
  return str.includes(',') || str.includes('"') || str.includes('\n') ? `"${str.replace(/"/g, '""')}"` : str;
}

export function exportStatisticsCsv(
  filename: string,
  headers: string[],
  keys: (keyof StatisticsTableRow)[],
  data: StatisticsTableRow[],
) {
  const csvRows = [
    headers.map(escapeCell).join(','),
    ...data.map((row) => keys.map((key) => escapeCell(row[key])).join(',')),
  ];

  const blob = new Blob(['\uFEFF' + csvRows.join('\n')], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

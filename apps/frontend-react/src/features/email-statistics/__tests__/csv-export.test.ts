import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { exportStatisticsCsv } from '../components/table/csv-export';
import type { StatisticsTableRow } from '../types';

describe('exportStatisticsCsv', () => {
  let capturedContent: string;
  let mockClick: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    capturedContent = '';
    mockClick = vi.fn();

    // jsdom doesn't have URL.createObjectURL — polyfill for tests
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:test');
    globalThis.URL.revokeObjectURL = vi.fn();

    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'a') {
        return { href: '', download: '', click: mockClick } as unknown as HTMLAnchorElement;
      }
      return document.createElement(tag);
    });

    // Capture blob content
    const OrigBlob = globalThis.Blob;
    vi.spyOn(globalThis, 'Blob').mockImplementation(((parts: BlobPart[], options?: BlobPropertyBag) => {
      capturedContent = parts.map(String).join('');
      return new OrigBlob(parts, options);
    }) as unknown as typeof Blob);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const mockRow = {
    date: '2026-04-01',
    delivered: 100,
    open: 50,
    percentageOpen: 50,
  } as unknown as StatisticsTableRow;

  it('generates CSV with BOM prefix for UTF-8 Excel compat', () => {
    exportStatisticsCsv('test', ['Date', 'Delivered'], ['date', 'delivered'], [mockRow]);
    expect(capturedContent.startsWith('\uFEFF')).toBe(true);
  });

  it('generates correct header row', () => {
    exportStatisticsCsv('test', ['Date', 'Delivered'], ['date', 'delivered'], [mockRow]);
    const lines = capturedContent.replace('\uFEFF', '').split('\n');
    expect(lines[0]).toBe('Date,Delivered');
  });

  it('generates correct data rows', () => {
    exportStatisticsCsv('test', ['Date', 'Delivered'], ['date', 'delivered'], [mockRow]);
    const lines = capturedContent.replace('\uFEFF', '').split('\n');
    expect(lines[1]).toBe('2026-04-01,100');
  });

  it('escapes values containing commas', () => {
    const row = { ...mockRow, date: 'April, 2026' } as unknown as StatisticsTableRow;
    exportStatisticsCsv('test', ['Date'], ['date'], [row]);
    const lines = capturedContent.replace('\uFEFF', '').split('\n');
    expect(lines[1]).toBe('"April, 2026"');
  });

  it('triggers download click', () => {
    exportStatisticsCsv('test', ['Date'], ['date'], [mockRow]);
    expect(mockClick).toHaveBeenCalled();
  });

  it('handles empty data array', () => {
    exportStatisticsCsv('test', ['Date'], ['date'], []);
    const lines = capturedContent.replace('\uFEFF', '').split('\n');
    expect(lines.length).toBe(1); // header only
  });
});

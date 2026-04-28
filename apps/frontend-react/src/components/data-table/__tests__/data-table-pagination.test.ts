import { describe, it, expect } from 'vitest';
import { getPageWindow } from '../data-table-pagination';

describe('getPageWindow', () => {
  it('returns all pages when totalPages <= 7', () => {
    expect(getPageWindow(1, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(getPageWindow(3, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('returns single page', () => {
    expect(getPageWindow(1, 1)).toEqual([1]);
  });

  it('shows ellipsis at end when current page is near start', () => {
    const result = getPageWindow(1, 20);
    expect(result).toEqual([1, 2, 'ellipsis', 20]);
  });

  it('shows ellipsis at start when current page is near end', () => {
    const result = getPageWindow(20, 20);
    expect(result).toEqual([1, 'ellipsis', 19, 20]);
  });

  it('shows ellipsis on both sides when current page is in middle', () => {
    const result = getPageWindow(10, 20);
    expect(result).toEqual([1, 'ellipsis', 9, 10, 11, 'ellipsis', 20]);
  });

  it('shows page 2 without ellipsis when current is 3', () => {
    const result = getPageWindow(3, 20);
    expect(result).toEqual([1, 2, 3, 4, 'ellipsis', 20]);
  });

  it('shows page before last without ellipsis when current is totalPages-2', () => {
    const result = getPageWindow(18, 20);
    expect(result).toEqual([1, 'ellipsis', 17, 18, 19, 20]);
  });

  it('always includes first and last page', () => {
    for (let page = 1; page <= 50; page++) {
      const window = getPageWindow(page, 50);
      expect(window[0]).toBe(1);
      expect(window[window.length - 1]).toBe(50);
    }
  });

  it('never has duplicate pages', () => {
    for (let page = 1; page <= 30; page++) {
      const window = getPageWindow(page, 30);
      const numbers = window.filter((x) => typeof x === 'number');
      const unique = new Set(numbers);
      expect(numbers.length).toBe(unique.size);
    }
  });
});

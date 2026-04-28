// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { type ColumnDef } from '@tanstack/react-table';
import '@/lib/i18n';
import { DataTable } from '../data-table';

interface TestItem {
  id: number;
  name: string;
  email: string;
}

const columns: ColumnDef<TestItem, unknown>[] = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'email', header: 'Email' },
];

const testData: TestItem[] = [
  { id: 1, name: 'Alice', email: 'alice@test.com' },
  { id: 2, name: 'Bob', email: 'bob@test.com' },
];

describe('DataTable', () => {
  it('renders column headers', () => {
    render(<DataTable columns={columns} data={testData} />);
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
  });

  it('renders row data', () => {
    render(<DataTable columns={columns} data={testData} />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('bob@test.com')).toBeInTheDocument();
  });

  it('renders skeleton rows when loading', () => {
    const { container } = render(<DataTable columns={columns} data={[]} isLoading />);
    const skeletons = container.querySelectorAll('[data-slot="skeleton"]');
    // 5 rows × 2 columns = 10 skeletons
    expect(skeletons.length).toBe(10);
  });

  it('renders error state with retry button', () => {
    const onRetry = vi.fn();
    render(<DataTable columns={columns} data={[]} error={new Error('Failed')} onRetry={onRetry} />);
    expect(screen.getByText(/erro ao carregar/i)).toBeInTheDocument();
    screen.getByRole('button').click();
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('applies opacity when fetching but not loading', () => {
    const { container } = render(<DataTable columns={columns} data={testData} isFetching />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain('opacity-60');
  });

  it('renders nothing in body when data is empty and not loading', () => {
    render(<DataTable columns={columns} data={[]} />);
    // Headers should still be present
    expect(screen.getByText('Name')).toBeInTheDocument();
    // No data rows or skeletons
    const tbody = screen.getByRole('table').querySelector('tbody');
    expect(tbody?.children.length).toBe(0);
  });
});

import { createContext, useContext, type ReactNode } from 'react';
import type { PaginationState, SortingState, Updater } from '@tanstack/react-table';

// --- Context ---

export interface ListPageContextValue<TData = unknown> {
  state: {
    data: TData[];
    isLoading: boolean;
    isFetching: boolean;
    isEmpty: boolean;
    totalRows: number;
  };
  table: {
    pagination: PaginationState;
    sorting: SortingState;
    setPagination: (updater: Updater<PaginationState>) => void;
    setSorting: (updater: Updater<SortingState>) => void;
  };
  search: {
    value: string;
    set: (value: string) => void;
  };
  meta: {
    entityName: string;
    entityNamePlural: string;
    basePath: string;
  };
}

const ListPageContext = createContext<ListPageContextValue | null>(null);

export function ListPageProvider<TData>({
  value,
  children,
}: {
  value: ListPageContextValue<TData>;
  children: ReactNode;
}) {
  return <ListPageContext.Provider value={value as ListPageContextValue}>{children}</ListPageContext.Provider>;
}

export function useListPage<TData = unknown>(): ListPageContextValue<TData> {
  const ctx = useContext(ListPageContext);
  if (!ctx) {
    throw new Error('useListPage must be used within a ListPageProvider');
  }
  return ctx as ListPageContextValue<TData>;
}

// --- Compound Components ---

function Root({ children }: { children: ReactNode }) {
  return <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">{children}</div>;
}

function Header({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}

function Toolbar({ children }: { children: ReactNode }) {
  return <div className="flex items-center gap-2">{children}</div>;
}

function Content({ children }: { children: ReactNode }) {
  return <div className="rounded-md border">{children}</div>;
}

function PaginationSlot({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

function Empty({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export const ListPage = {
  Root,
  Header,
  Toolbar,
  Content,
  Pagination: PaginationSlot,
  Empty,
};

import { useTranslation } from 'react-i18next';
import { Link } from '@tanstack/react-router';
import { getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { Users, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/data-table/data-table';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import { DataTableSearch } from '@/components/data-table/data-table-search';
import { DataTableEmptyState } from '@/components/data-table/data-table-empty-state';
import { ListPage } from '@/components/list-page';
import { useListSearchParams, type ListSearchParams } from '@/hooks/use-list-search-params';
import { useSuperAdminUsersList } from './use-super-admin-users';
import { useSuperAdminUsersColumns } from './users-columns';
import type { SuperAdminUser } from './types';

const EMPTY_ARRAY: SuperAdminUser[] = [];

interface SuperAdminUsersPageProps {
  searchParams: ListSearchParams;
}

export default function SuperAdminUsersPage({ searchParams }: SuperAdminUsersPageProps) {
  const { t } = useTranslation();

  const { pagination, sorting, searchParams: normalizedParams, setPagination, setSorting, setSearch } = useListSearchParams(searchParams);

  const query = useSuperAdminUsersList(normalizedParams);
  const columns = useSuperAdminUsersColumns();

  const data = query.data?.data ?? EMPTY_ARRAY;
  const totalRows = query.data?.meta.total ?? 0;
  const totalPages = Math.ceil(totalRows / normalizedParams.pageSize);

  const table = useReactTable({
    columns,
    data,
    rowCount: totalRows,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    state: { pagination, sorting },
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
  });

  const isEmpty = !query.isLoading && data.length === 0;

  return (
    <ListPage.Root>
      <ListPage.Header title={t('superAdmin.users.pageTitle')}>
        <Button size="sm" asChild>
          <Link to="/super-admin/users/create">
            <Plus className="mr-1 h-4 w-4" />
            {t('superAdmin.users.createUser')}
          </Link>
        </Button>
      </ListPage.Header>

      <ListPage.Toolbar>
        <DataTableSearch value={normalizedParams.search} onChange={setSearch} />
      </ListPage.Toolbar>

      {isEmpty ? (
        <ListPage.Empty>
          <DataTableEmptyState
            entityName={t('superAdmin.users.entityNamePlural')}
            hasSearch={normalizedParams.search.length > 0}
            onClearSearch={() => setSearch('')}
            icon={Users}
          />
        </ListPage.Empty>
      ) : (
        <>
          <ListPage.Content>
            <DataTable
              columns={columns}
              table={table}
              isLoading={query.isLoading}
              isFetching={query.isFetching}
              error={query.error}
              onRetry={() => query.refetch()}
            />
          </ListPage.Content>

          <ListPage.Pagination>
            <DataTablePagination
              currentPage={normalizedParams.page}
              totalPages={totalPages}
              pageSize={normalizedParams.pageSize}
              totalRows={totalRows}
              onPageChange={(page) => setPagination((prev) => ({ ...prev, pageIndex: page - 1 }))}
              onPageSizeChange={(size) => setPagination({ pageIndex: 0, pageSize: size })}
            />
          </ListPage.Pagination>
        </>
      )}
    </ListPage.Root>
  );
}

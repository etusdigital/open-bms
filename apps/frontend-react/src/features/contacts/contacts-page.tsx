import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from '@tanstack/react-router';
import { getCoreRowModel, useReactTable, type RowSelectionState } from '@tanstack/react-table';
import { Users, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { TooltipProvider } from '@/components/ui/tooltip';
import { DataTable } from '@/components/data-table/data-table';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import { DataTableSearch } from '@/components/data-table/data-table-search';
import { DataTableEmptyState } from '@/components/data-table/data-table-empty-state';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { ListPage } from '@/components/list-page';
import { useListSearchParams } from '@/hooks/use-list-search-params';
import type { ContactsSearchParams } from './contacts-search-schema';
import { usePermissions } from '@/hooks/use-permissions';
import { useContactsList, useContactDashboard, useDeleteContact } from './use-contacts';
import { useContactsColumns, selectColumn } from './contacts-columns';
import { ContactsFilterBar } from './components/contacts-filter-bar';
import { BulkActionsBar } from './components/bulk-actions-bar';
import type { Contact } from './types';

const EMPTY_ARRAY: Contact[] = [];

interface ContactsPageProps {
  searchParams: ContactsSearchParams;
}

export default function ContactsPage({ searchParams }: ContactsPageProps) {
  const { t } = useTranslation();
  const { can } = usePermissions();
  const canImport = can('audience:contacts_import');

  const { pagination, sorting, setPagination, setSorting, setSearch } = useListSearchParams(searchParams);

  const query = useContactsList(searchParams);
  const dashboard = useContactDashboard();
  const deleteContact = useDeleteContact();

  const [deleteTarget, setDeleteTarget] = useState<Contact | null>(null);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  // Clear selection when filters/page change
  const prevSearchRef = useRef(searchParams);
  useEffect(() => {
    const prev = prevSearchRef.current;
    const filtersChanged =
      prev.tags !== searchParams.tags ||
      prev.segments !== searchParams.segments ||
      prev.status !== searchParams.status ||
      prev.search !== searchParams.search ||
      prev.page !== searchParams.page;
    if (filtersChanged) {
      setRowSelection({});
    }
    prevSearchRef.current = searchParams;
  }, [searchParams]);

  const handleDelete = useCallback((contact: Contact) => {
    setDeleteTarget(contact);
  }, []);

  const confirmDelete = useCallback(() => {
    if (!deleteTarget) return;
    deleteContact.mutate(deleteTarget.id, {
      onSuccess: () => {
        setDeleteTarget(null);
        setRowSelection({});
        const data = query.data?.data ?? [];
        if (data.length === 1 && searchParams.page > 1) {
          setPagination((prev) => ({
            ...prev,
            pageIndex: prev.pageIndex - 1,
          }));
        }
      },
    });
  }, [deleteTarget, deleteContact, query.data?.data, searchParams.page, setPagination]);

  const handleBulkDeleteSuccess = useCallback(
    (deletedCount: number) => {
      const visibleRows = query.data?.data?.length ?? 0;
      if (deletedCount >= visibleRows && searchParams.page > 1) {
        setPagination((prev) => ({ ...prev, pageIndex: prev.pageIndex - 1 }));
      }
    },
    [query.data?.data, searchParams.page, setPagination],
  );

  const entityColumns = useContactsColumns({ onDelete: handleDelete, canDelete: canImport });
  const allColumns = useMemo(() => [selectColumn, ...entityColumns], [entityColumns]);

  const data = query.data?.data ?? EMPTY_ARRAY;
  const totalRows = query.data?.meta.total ?? 0;
  const totalPages = Math.ceil(totalRows / searchParams.pageSize);

  const table = useReactTable({
    columns: allColumns,
    data,
    rowCount: totalRows,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    getRowId: (row) => String(row.id),
    state: { pagination, sorting, rowSelection },
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
  });

  const selectedIds = Object.keys(rowSelection)
    .filter((key) => rowSelection[key])
    .map(Number);

  const selectedEmails = selectedIds.map((id) => data.find((c) => c.id === id)?.email).filter(Boolean) as string[];

  const isEmpty = !query.isLoading && data.length === 0;

  return (
    <TooltipProvider>
      <ListPage.Root>
        <ListPage.Header title={t('contacts.pageTitle')}>
          {canImport && (
            <Button size="sm" asChild>
              <Link to="/contacts/import">
                <Upload className="mr-1 h-4 w-4" />
                {t('contacts.import')}
              </Link>
            </Button>
          )}
        </ListPage.Header>

        {/* Dashboard Cards */}
        <div className="mb-4 grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-muted-foreground text-xs">{t('contacts.totalContacts')}</p>
              <p className="text-2xl font-bold">{dashboard.data?.total?.toLocaleString() ?? '—'}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-muted-foreground text-xs">{t('contacts.subscribedToday')}</p>
              <p className="text-2xl font-bold">{dashboard.data?.subscribedToday?.toLocaleString() ?? '—'}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-muted-foreground text-xs">{t('contacts.activeContacts')}</p>
              <p className="text-2xl font-bold">{dashboard.data?.active?.toLocaleString() ?? '—'}</p>
            </CardContent>
          </Card>
        </div>

        <ListPage.Toolbar>
          <DataTableSearch value={searchParams.search} onChange={setSearch} />
          <div className="ml-auto">
            <ContactsFilterBar searchParams={searchParams} />
          </div>
        </ListPage.Toolbar>

        {selectedIds.length > 0 && (
          <div className="px-1 pb-2">
            <BulkActionsBar
              selectedIds={selectedIds}
              selectedEmails={selectedEmails}
              onClearSelection={() => setRowSelection({})}
              canDelete={canImport}
              onBulkDeleteSuccess={handleBulkDeleteSuccess}
            />
          </div>
        )}

        {isEmpty ? (
          <ListPage.Empty>
            <DataTableEmptyState
              entityName={t('contacts.entityNamePlural')}
              hasSearch={searchParams.search.length > 0}
              onClearSearch={() => setSearch('')}
              icon={Users}
            />
          </ListPage.Empty>
        ) : (
          <>
            <ListPage.Content>
              <DataTable
                columns={allColumns}
                table={table}
                isLoading={query.isLoading}
                isFetching={query.isFetching}
                error={query.error}
                onRetry={() => query.refetch()}
              />
            </ListPage.Content>

            <ListPage.Pagination>
              <DataTablePagination
                currentPage={searchParams.page}
                totalPages={totalPages}
                pageSize={searchParams.pageSize}
                totalRows={totalRows}
                onPageChange={(page) => setPagination((prev) => ({ ...prev, pageIndex: page - 1 }))}
                onPageSizeChange={(size) => setPagination({ pageIndex: 0, pageSize: size })}
              />
            </ListPage.Pagination>
          </>
        )}
      </ListPage.Root>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={t('common.deleteConfirmTitle', { entity: t('contacts.entityName') })}
        description={t('common.deleteConfirmMessage', {
          name: deleteTarget?.email ?? '',
        })}
        onConfirm={confirmDelete}
        loading={deleteContact.isPending}
      />
    </TooltipProvider>
  );
}

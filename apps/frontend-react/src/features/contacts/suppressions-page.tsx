import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from '@tanstack/react-router';
import { getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { ArrowLeft, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { DataTable } from '@/components/data-table/data-table';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import { DataTableSearch } from '@/components/data-table/data-table-search';
import { DataTableEmptyState } from '@/components/data-table/data-table-empty-state';
import { ListPage } from '@/components/list-page';
import { useListSearchParams, type ListSearchParams } from '@/hooks/use-list-search-params';
import { useSuppressedList, useBulkSuppress, type SuppressionType } from './use-suppressions';
import { useSuppressionsColumns } from './suppressions-columns';
import type { SuppressedContact } from './types';

const EMPTY_ARRAY: SuppressedContact[] = [];

interface SuppressionsPageProps {
  type: SuppressionType;
  searchParams: ListSearchParams;
}

export function SuppressionsPage({ type, searchParams }: SuppressionsPageProps) {
  const { t } = useTranslation();
  const { pagination, sorting, setPagination, setSorting, setSearch } = useListSearchParams(searchParams);

  const query = useSuppressedList(type, searchParams);
  const bulkSuppress = useBulkSuppress();
  const columns = useSuppressionsColumns(type);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [emailsText, setEmailsText] = useState('');

  const tableData = query.data?.data ?? EMPTY_ARRAY;
  const totalRows = query.data?.meta.total ?? 0;
  const totalPages = Math.ceil(totalRows / searchParams.pageSize);

  const table = useReactTable({
    data: tableData,
    columns,
    rowCount: totalRows,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    state: { pagination, sorting },
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
  });

  const pageTitle = type === 'unsubscribed' ? t('contacts.suppressionUnsubscribed') : t('contacts.suppressionBlocked');

  const actionLabel =
    type === 'unsubscribed' ? t('contacts.suppressionUnsubscribeAction') : t('contacts.suppressionBlockAction');

  const handleBulkSubmit = useCallback(() => {
    const emails = emailsText
      .split(/[\n,;]+/)
      .map((e) => e.trim())
      .filter((e) => e.length > 0);

    if (emails.length === 0) return;

    bulkSuppress.mutate(
      { emails, block: type === 'blocked' },
      {
        onSuccess: () => {
          setDialogOpen(false);
          setEmailsText('');
        },
      },
    );
  }, [emailsText, type, bulkSuppress]);

  const isEmpty = !query.isLoading && tableData.length === 0;

  return (
    <ListPage.Root>
      <div>
        <Link
          to="/contacts"
          search={{} as never}
          className="text-muted-foreground hover:text-foreground mb-2 inline-flex items-center gap-1 text-sm"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('contacts.pageTitle')}
        </Link>
        <ListPage.Header title={pageTitle}>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {actionLabel}
          </Button>
        </ListPage.Header>
      </div>

      <ListPage.Toolbar>
        <DataTableSearch value={searchParams.search} onChange={setSearch} />
      </ListPage.Toolbar>

      {isEmpty ? (
        <ListPage.Empty>
          <DataTableEmptyState
            entityName={pageTitle.toLowerCase()}
            hasSearch={searchParams.search.length > 0}
            onClearSearch={() => setSearch('')}
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

      {/* Bulk add dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{actionLabel}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-muted-foreground text-sm">{t('contacts.suppressionBulkDescription')}</p>
            <Textarea
              value={emailsText}
              onChange={(e) => setEmailsText(e.target.value)}
              placeholder={t('contacts.suppressionBulkPlaceholder')}
              rows={6}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleBulkSubmit} disabled={bulkSuppress.isPending || emailsText.trim().length === 0}>
              {bulkSuppress.isPending ? t('common.loading') : t('common.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ListPage.Root>
  );
}

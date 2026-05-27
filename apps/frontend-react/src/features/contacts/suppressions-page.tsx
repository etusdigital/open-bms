import { useState, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from '@tanstack/react-router';
import { getCoreRowModel, useReactTable, type RowSelectionState } from '@tanstack/react-table';
import { ArrowLeft, Plus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { DataTable } from '@/components/data-table/data-table';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import { DataTableSearch } from '@/components/data-table/data-table-search';
import { DataTableEmptyState } from '@/components/data-table/data-table-empty-state';
import { ListPage } from '@/components/list-page';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { useListSearchParams, type ListSearchParams } from '@/hooks/use-list-search-params';
import { useSuppressedList, useBulkSuppress, useBulkResubscribe, type SuppressionType } from './use-suppressions';
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
  const bulkResubscribe = useBulkResubscribe();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [emailsText, setEmailsText] = useState('');
  const [confirmEmail, setConfirmEmail] = useState<string | null>(null);
  const [bulkResubscribeOpen, setBulkResubscribeOpen] = useState(false);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const columns = useSuppressionsColumns(type, {
    onResubscribe: (email) => setConfirmEmail(email),
    resubscribeDisabled: bulkResubscribe.isPending,
  });

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
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    getRowId: (row) => row.email,
    state: { pagination, sorting, rowSelection },
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
  });

  // Clear selection when filters/pagination change
  const prevSearchRef = useRef(searchParams);
  useEffect(() => {
    const prev = prevSearchRef.current;
    if (prev.search !== searchParams.search || prev.page !== searchParams.page || prev.pageSize !== searchParams.pageSize) {
      setRowSelection({});
    }
    prevSearchRef.current = searchParams;
  }, [searchParams]);

  const selectedEmails = Object.keys(rowSelection).filter((key) => rowSelection[key]);
  const selectedCount = selectedEmails.length;

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

      {selectedCount > 0 && (
        <div className="px-1 pb-2">
          <div className="bg-muted/50 flex items-center gap-3 rounded-md border px-4 py-2">
            <span className="text-sm font-medium">{t('contacts.bulkActionsSelected', { count: selectedCount })}</span>
            <Separator orientation="vertical" className="h-5" />
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => setBulkResubscribeOpen(true)}
              disabled={bulkResubscribe.isPending}
            >
              <Trash2 className="mr-1 h-3.5 w-3.5" />
              {t('contacts.resubscribeAction')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto text-xs"
              onClick={() => setRowSelection({})}
              disabled={bulkResubscribe.isPending}
            >
              <X className="mr-1 h-3 w-3" />
              {t('contacts.clearSelection')}
            </Button>
          </div>
        </div>
      )}

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

      <ConfirmDialog
        open={confirmEmail !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmEmail(null);
        }}
        title={t('contacts.resubscribeConfirmTitle')}
        description={t('contacts.resubscribeConfirmDescription', { email: confirmEmail ?? '' })}
        confirmLabel={t('contacts.resubscribeAction')}
        loading={bulkResubscribe.isPending}
        variant="destructive"
        onConfirm={() => {
          if (!confirmEmail) return;
          bulkResubscribe.mutate(
            { emails: [confirmEmail], block: type === 'blocked' },
            { onSuccess: () => setConfirmEmail(null) },
          );
        }}
      />

      <ConfirmDialog
        open={bulkResubscribeOpen}
        onOpenChange={setBulkResubscribeOpen}
        title={t('contacts.resubscribeConfirmTitle')}
        description={t('contacts.resubscribeBulkConfirmDescription', { count: selectedCount })}
        confirmLabel={t('contacts.resubscribeAction')}
        loading={bulkResubscribe.isPending}
        variant="destructive"
        onConfirm={() => {
          if (selectedEmails.length === 0) return;
          bulkResubscribe.mutate(
            { emails: selectedEmails, block: type === 'blocked' },
            {
              onSuccess: () => {
                setBulkResubscribeOpen(false);
                setRowSelection({});
              },
            },
          );
        }}
      />

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

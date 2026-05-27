import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from '@tanstack/react-router';
import { getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { TagIcon, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/data-table/data-table';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import { DataTableSearch } from '@/components/data-table/data-table-search';
import { DataTableEmptyState } from '@/components/data-table/data-table-empty-state';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { ListPage } from '@/components/list-page';
import { useListSearchParams, type ListSearchParams } from '@/hooks/use-list-search-params';
import { usePermissions } from '@/hooks/use-permissions';
import { useTagsList, useDeleteTag } from './use-tags';
import { useTagsColumns } from './tags-columns';
import type { Tag } from './types';

const EMPTY_ARRAY: Tag[] = [];

interface TagsPageProps {
  searchParams: ListSearchParams;
}

export default function TagsPage({ searchParams }: TagsPageProps) {
  const { t } = useTranslation();
  const { can } = usePermissions();
  const canCreate = can('audience:tags_create');
  const canDelete = can('audience:tags_create'); // Use create permission for now

  const { pagination, sorting, setPagination, setSorting, setSearch } = useListSearchParams(searchParams);

  const query = useTagsList(searchParams);
  const deleteTag = useDeleteTag();

  const [deleteTarget, setDeleteTarget] = useState<Tag | null>(null);

  const handleDelete = useCallback((tag: Tag) => {
    setDeleteTarget(tag);
  }, []);

  const confirmDelete = useCallback(() => {
    if (!deleteTarget) return;
    deleteTag.mutate(deleteTarget.id, {
      onSuccess: () => {
        setDeleteTarget(null);
        // If last item on page and page > 1, go to previous page
        const data = query.data?.data ?? [];
        if (data.length === 1 && searchParams.page > 1) {
          setPagination((prev) => ({
            ...prev,
            pageIndex: prev.pageIndex - 1,
          }));
        }
      },
    });
  }, [deleteTarget, deleteTag, query.data?.data, searchParams.page, setPagination]);

  const columns = useTagsColumns({ onDelete: handleDelete, canDelete });

  const data = query.data?.data ?? EMPTY_ARRAY;
  const totalRows = query.data?.meta.total ?? 0;
  const totalPages = Math.ceil(totalRows / searchParams.pageSize);

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
    <>
      <ListPage.Root>
        <ListPage.Header title={t('tags.title')}>
          {canCreate && (
            <Button size="sm" asChild>
              <Link to="/tags/create">
                <Plus className="mr-1 h-4 w-4" />
                {t('tags.createTag')}
              </Link>
            </Button>
          )}
        </ListPage.Header>

        <ListPage.Toolbar>
          <DataTableSearch value={searchParams.search} onChange={setSearch} />
        </ListPage.Toolbar>

        {isEmpty ? (
          <ListPage.Empty>
            <DataTableEmptyState
              entityName={t('tags.entityNamePlural')}
              hasSearch={searchParams.search.length > 0}
              onClearSearch={() => setSearch('')}
              icon={TagIcon}
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
      </ListPage.Root>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={t('common.deleteConfirmTitle', { entity: t('tags.entityName') })}
        description={t('common.deleteConfirmMessage', {
          name: deleteTarget?.name ?? '',
        })}
        onConfirm={confirmDelete}
        loading={deleteTag.isPending}
      />
    </>
  );
}

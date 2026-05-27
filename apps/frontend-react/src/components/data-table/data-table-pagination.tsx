import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PAGE_SIZE_OPTIONS } from '@/hooks/use-list-search-params';

interface DataTablePaginationProps {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalRows: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

/**
 * Pagination controls with page numbers (window of 5), prev/next,
 * page size selector, and results count.
 */
export function DataTablePagination({
  currentPage,
  totalPages,
  pageSize,
  totalRows,
  onPageChange,
  onPageSizeChange,
}: DataTablePaginationProps) {
  const { t } = useTranslation();

  const from = totalRows === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const to = Math.min(currentPage * pageSize, totalRows);

  const pageWindow = useMemo(() => getPageWindow(currentPage, totalPages), [currentPage, totalPages]);

  if (totalPages <= 0) return null;

  return (
    <div className="flex items-center justify-between gap-4 px-2 py-4">
      <p className="text-muted-foreground text-sm whitespace-nowrap">
        {t('common.showingResults', { from, to, total: totalRows })}
      </p>

      <Pagination className="mx-0 w-auto">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage <= 1}
              aria-disabled={currentPage <= 1}
            />
          </PaginationItem>

          {pageWindow.map((item, i) =>
            item === 'ellipsis' ? (
              <PaginationItem key={`ellipsis-${i}`}>
                <PaginationEllipsis />
              </PaginationItem>
            ) : (
              <PaginationItem key={item}>
                <PaginationLink isActive={item === currentPage} onClick={() => onPageChange(item)}>
                  {item}
                </PaginationLink>
              </PaginationItem>
            ),
          )}

          <PaginationItem>
            <PaginationNext
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage >= totalPages}
              aria-disabled={currentPage >= totalPages}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>

      <Select value={String(pageSize)} onValueChange={(val) => onPageSizeChange(Number(val))}>
        <SelectTrigger className="w-auto gap-1">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PAGE_SIZE_OPTIONS.map((size) => (
            <SelectItem key={size} value={String(size)}>
              {size} {t('common.itemsPerPage').toLowerCase()}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

type PageWindowItem = number | 'ellipsis';

/**
 * Builds a page number window: always shows first, last, and up to 5
 * numbers centered around the current page, with ellipsis for gaps.
 */
export function getPageWindow(currentPage: number, totalPages: number): PageWindowItem[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages: PageWindowItem[] = [];

  // Always show page 1
  pages.push(1);

  // Calculate window around current page
  const windowStart = Math.max(2, currentPage - 1);
  const windowEnd = Math.min(totalPages - 1, currentPage + 1);

  if (windowStart > 2) {
    pages.push('ellipsis');
  }

  for (let i = windowStart; i <= windowEnd; i++) {
    pages.push(i);
  }

  if (windowEnd < totalPages - 1) {
    pages.push('ellipsis');
  }

  // Always show last page
  pages.push(totalPages);

  return pages;
}

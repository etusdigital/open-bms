import { useCallback, useMemo, useState } from 'react';
import { useNavigate, useSearch, Link } from '@tanstack/react-router';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FilterBar } from './filter-bar';
import { useActivityEvents, type ActivityEvent } from './use-activity-events';
import { parseQ, serializeQ } from './q-builder';

const EVENT_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  delivered: 'default',
  open: 'secondary',
  click: 'secondary',
  bounce: 'destructive',
  dropped: 'destructive',
  spam: 'destructive',
  blocked: 'destructive',
  unsubscribe: 'outline',
  deferred: 'outline',
  processed: 'outline',
};

export default function ActivityPage() {
  const search = useSearch({ from: '/_authenticated/_layout/super-admin/activity/' });
  const navigate = useNavigate({ from: '/super-admin/activity' });
  const q = search.q ?? '';
  const page = search.page ?? 1;

  const filters = useMemo(() => parseQ(q), [q]);

  const onFiltersChange = useCallback(
    (next: ReturnType<typeof parseQ>) => {
      const nextQ = serializeQ(next);
      if (nextQ === q) return;
      navigate({ search: () => ({ q: nextQ || undefined, page: undefined }), replace: true });
    },
    [navigate, q],
  );

  const goToPage = (next: number) => {
    navigate({ search: (prev) => ({ ...prev, page: next > 1 ? next : undefined }), replace: false });
  };

  const { data, isLoading, isError, error, isFetching } = useActivityEvents(q, page);
  const events = data?.events ?? [];
  const hasNext = data?.hasNext ?? false;
  const appliedRange = data?.appliedRange;
  const errorMessage =
    (error as { response?: { data?: { message?: string } } } | null)?.response?.data?.message ?? 'Failed to load events';

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Activity Feed</h1>

      <FilterBar value={filters} onChange={onFiltersChange} />

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div>
          {isLoading ? 'Loading…' : `Page ${page} · ${events.length} results${hasNext ? '+' : ''}`}
        </div>
        {appliedRange && (
          <div>
            Range: {new Date(appliedRange.after).toLocaleString()} → {new Date(appliedRange.before).toLocaleString()}
          </div>
        )}
      </div>

      {isError && <div className="text-sm text-red-600">{errorMessage}</div>}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[180px]">Date</TableHead>
              <TableHead className="w-[110px]">Event</TableHead>
              <TableHead>Recipient</TableHead>
              <TableHead>Campaign / Automation</TableHead>
              <TableHead className="w-[120px]">Provider</TableHead>
              <TableHead className="w-[80px]">Account</TableHead>
              <TableHead className="w-[40px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {!isLoading && events.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">
                  No events match the current filter.
                </TableCell>
              </TableRow>
            )}
            {events.map((e) => (
              <EventRow key={`${e.events_logs_id}-${e.time}`} event={e} />
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={() => goToPage(page - 1)} disabled={page <= 1 || isFetching}>
          Previous
        </Button>
        <span className="text-xs text-muted-foreground">Page {page}</span>
        <Button variant="outline" size="sm" onClick={() => goToPage(page + 1)} disabled={!hasNext || isFetching}>
          Next
        </Button>
      </div>
    </div>
  );
}

function EventRow({ event }: { event: ActivityEvent }) {
  const [open, setOpen] = useState(false);
  const variant = EVENT_VARIANT[event.event] ?? 'outline';

  return (
    <>
      <TableRow className="cursor-pointer" onClick={() => setOpen((v) => !v)}>
        <TableCell className="font-mono text-xs">{new Date(`${event.time.replace(' ', 'T')}Z`).toLocaleString()}</TableCell>
        <TableCell>
          <Badge variant={variant}>{event.event}</Badge>
        </TableCell>
        <TableCell className="font-mono text-xs truncate max-w-[260px]">{event.email || event.contact_id}</TableCell>
        <TableCell className="text-xs">
          {event.campaign_id > 0 && (
            <Link
              to="/campaigns/$id"
              params={{ id: String(event.campaign_id) }}
              className="text-blue-600 underline mr-2"
              onClick={(ev) => ev.stopPropagation()}
            >
              campaign:{event.campaign_id}
            </Link>
          )}
          {event.automation_id > 0 && (
            <Link
              to="/automations/$id"
              params={{ id: String(event.automation_id) }}
              className="text-blue-600 underline"
              onClick={(ev) => ev.stopPropagation()}
            >
              automation:{event.automation_id}
            </Link>
          )}
        </TableCell>
        <TableCell className="text-xs">{event.provider}</TableCell>
        <TableCell className="text-xs">{event.account_id}</TableCell>
        <TableCell>{open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</TableCell>
      </TableRow>
      {open && (
        <TableRow>
          <TableCell colSpan={7} className="bg-muted/30">
            <pre className="text-xs overflow-x-auto whitespace-pre-wrap p-2">{JSON.stringify(event, null, 2)}</pre>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

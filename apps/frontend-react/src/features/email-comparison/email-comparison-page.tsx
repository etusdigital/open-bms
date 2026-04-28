import { useState, useMemo, useCallback, useEffect, startTransition } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from '@tanstack/react-router';
import { Mail, Bell, Hash, Percent, X, Eye } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { ListPage } from '@/components/list-page';
import { useMessageComparison } from './use-email-comparison';
import { useResolveMessages, type ResolvedMessage } from './use-resolve-messages';
import { MessagePreviewDialog } from './components/message-preview-dialog';
import { MessageMultiSelect } from './components/message-multi-select';
import { ComparisonBarChart } from './components/comparison-bar-chart';
import { ComparisonLineChart } from './components/comparison-line-chart';
import { DateRangePicker } from '@/components/date-range-picker';
import type { ComparisonMessageType, MetricType, DisplayMode, SelectedMessage } from './types';
import type { ComparisonSearchParams } from './comparison-search-schema';

const EMAIL_METRICS: MetricType[] = ['delivered', 'open', 'click', 'ctor', 'unsubscribe', 'bounce'];
const PUSH_METRICS: MetricType[] = ['delivered', 'click', 'sent', 'close'];

function parseCsvIds(csv: string): number[] {
  if (!csv) return [];
  return csv
    .split(',')
    .filter(Boolean)
    .map(Number)
    .filter((n) => !isNaN(n));
}

interface EmailComparisonPageProps {
  searchParams: ComparisonSearchParams;
}

export default function EmailComparisonPage({ searchParams }: EmailComparisonPageProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // Read state from URL
  const messageType = searchParams.type as ComparisonMessageType;
  const metricType = searchParams.metricType as MetricType;
  const displayMode = searchParams.displayMode as DisplayMode;
  const messageIds = useMemo(() => parseCsvIds(searchParams.messagesIds), [searchParams.messagesIds]);

  const startDate = searchParams.startDate || format(subDays(new Date(), 7), 'yyyy-MM-dd');
  const endDate = searchParams.endDate || format(new Date(), 'yyyy-MM-dd');

  // Local cache for full message data (not stored in URL)
  const [messageCache, setMessageCache] = useState<Map<number, ResolvedMessage>>(new Map());
  const [previewMessage, setPreviewMessage] = useState<ResolvedMessage | null>(null);

  // Fetch full message data for IDs present in URL (on page load / shared link)
  const idsToResolve = useMemo(() => messageIds.filter((id) => !messageCache.has(id)), [messageIds, messageCache]);
  const resolveQuery = useResolveMessages(idsToResolve);

  useEffect(() => {
    if (resolveQuery.data && resolveQuery.data.length > 0) {
      setMessageCache((prev) => {
        const next = new Map(prev);
        for (const m of resolveQuery.data) next.set(m.id, m);
        return next;
      });
    }
  }, [resolveQuery.data]);

  const selectedMessages = useMemo<SelectedMessage[]>(
    () => messageIds.map((id) => ({ id, title: messageCache.get(id)?.title ?? `#${id}` })),
    [messageIds, messageCache],
  );

  const query = useMessageComparison(messageType, messageIds, startDate, endDate);
  const availableMetrics = messageType === 'email' ? EMAIL_METRICS : PUSH_METRICS;

  const updateSearch = useCallback(
    (updates: Partial<ComparisonSearchParams>) => {
      startTransition(() => {
        void navigate({
          to: '.',
          search: (prev: Record<string, unknown>) => ({ ...prev, ...updates }),
        } as never);
      });
    },
    [navigate],
  );

  const handleTypeChange = useCallback(
    (type: ComparisonMessageType) => {
      setMessageCache(new Map());
      updateSearch({ type, messagesIds: '', metricType: 'delivered', displayMode: 'numeric' });
    },
    [updateSearch],
  );

  const handleMessagesChange = useCallback(
    (msgs: SelectedMessage[]) => {
      setMessageCache((prev) => {
        const next = new Map(prev);
        for (const m of msgs) next.set(m.id, { id: m.id, title: m.title });
        return next;
      });
      updateSearch({ messagesIds: msgs.map((m) => m.id).join(',') });
    },
    [updateSearch],
  );

  const handleRemoveMessage = useCallback(
    (id: number) => {
      const newIds = messageIds.filter((mid) => mid !== id);
      updateSearch({ messagesIds: newIds.join(',') });
    },
    [messageIds, updateSearch],
  );

  const handleDateChange = useCallback(
    (from: string, to: string) => {
      updateSearch({ startDate: from, endDate: to });
    },
    [updateSearch],
  );

  const metricLabel = t(`emailComparison.${metricType}`);
  const hasMessages = messageIds.length > 0;

  const hasData = useMemo(() => {
    if (!hasMessages || !query.data) return false;
    const keys = Object.keys(query.data);
    if (keys.length === 0) return false;
    // Flat format (non-grouped) has 'general' at top level — not valid for comparison
    if ('general' in query.data && 'daily' in query.data) return false;
    return true;
  }, [hasMessages, query.data]);

  return (
    <ListPage.Root>
      <ListPage.Header title={t('emailComparison.pageTitle')} />

      <div>
        {/* Tabs */}
        <div className="bg-card mb-6 flex gap-2 rounded-xl border p-3 shadow-sm">
          <button
            type="button"
            onClick={() => handleTypeChange('email')}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
              messageType === 'email' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted',
            )}
          >
            <Mail className="h-4 w-4" />
            E-mail
          </button>
          <button
            type="button"
            onClick={() => handleTypeChange('web-push')}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
              messageType === 'web-push'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted',
            )}
          >
            <Bell className="h-4 w-4" />
            Web Push
          </button>
        </div>

        {/* Filters toolbar */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <MessageMultiSelect messageType={messageType} selected={selectedMessages} onChange={handleMessagesChange} />

          <div data-testid="metric-selector">
            <Select value={metricType} onValueChange={(v) => updateSearch({ metricType: v })}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableMetrics.map((m) => (
                  <SelectItem key={m} value={m}>
                    {t(`emailComparison.${m}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DateRangePicker from={startDate} to={endDate} onChange={handleDateChange} />

          <div className="flex items-center" data-testid="display-mode-toggle">
            <Button
              variant={displayMode === 'numeric' ? 'default' : 'outline'}
              size="icon"
              className="h-9 w-9 rounded-r-none"
              onClick={() => updateSearch({ displayMode: 'numeric' })}
              disabled={metricType === 'ctor'}
            >
              <Hash className="h-4 w-4" />
            </Button>
            <Button
              variant={displayMode === 'percentage' ? 'default' : 'outline'}
              size="icon"
              className="h-9 w-9 rounded-l-none"
              onClick={() => updateSearch({ displayMode: 'percentage' })}
            >
              <Percent className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Selected message chips */}
        {selectedMessages.length > 0 && (
          <div className="mb-6 flex flex-wrap items-center gap-2">
            {selectedMessages.map((msg) => (
              <span key={msg.id} className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm">
                {msg.title}
                <button
                  onClick={() => setPreviewMessage(messageCache.get(msg.id) ?? null)}
                  className="hover:bg-muted text-muted-foreground hover:text-foreground rounded-full p-0.5"
                  title={t('emailComparison.previewMessage')}
                >
                  <Eye className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => handleRemoveMessage(msg.id)}
                  className="hover:bg-muted text-muted-foreground hover:text-foreground rounded-full p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Content */}
        {!hasMessages ? (
          <div className="text-muted-foreground flex flex-col items-center justify-center py-16">
            <p>{t('emailComparison.selectToStart')}</p>
          </div>
        ) : query.isLoading ? (
          <div className="space-y-6">
            <Card>
              <CardContent className="pt-6">
                <div className="bg-muted h-[345px] animate-pulse rounded" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="bg-muted h-[345px] animate-pulse rounded" />
              </CardContent>
            </Card>
          </div>
        ) : hasData ? (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">
                  {t('emailComparison.metricPerMessage', { metric: metricLabel })}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ComparisonBarChart
                  data={query.data!}
                  messages={selectedMessages}
                  metric={metricType}
                  displayMode={displayMode}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">
                  {t('emailComparison.metricPerDay', { metric: metricLabel })}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ComparisonLineChart
                  data={query.data!}
                  messages={selectedMessages}
                  metric={metricType}
                  displayMode={displayMode}
                />
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="text-muted-foreground flex flex-col items-center justify-center py-16">
            <p>{t('emailComparison.noDataPeriod')}</p>
          </div>
        )}
      </div>

      <MessagePreviewDialog
        message={previewMessage}
        open={!!previewMessage}
        onOpenChange={(open) => {
          if (!open) setPreviewMessage(null);
        }}
      />
    </ListPage.Root>
  );
}

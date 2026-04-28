import { memo, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Zap, Send, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useContactHistory } from '../use-contact-history';
import { getEventTime, getEventLabel } from '../contacts-utils';
import type { HistoryItem } from '../types';

function getDatePreset(preset: string): { startDate: string; endDate: string } {
  const now = new Date();
  const end = now.toISOString().slice(0, 10);

  switch (preset) {
    case 'today':
      return { startDate: end, endDate: end };
    case '7d': {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      return { startDate: d.toISOString().slice(0, 10), endDate: end };
    }
    case '30d': {
      const d = new Date(now);
      d.setDate(d.getDate() - 30);
      return { startDate: d.toISOString().slice(0, 10), endDate: end };
    }
    default:
      return { startDate: '', endDate: '' };
  }
}

function getHistoryItemIcon(item: HistoryItem) {
  switch (item.type) {
    case 'automation':
      return <Zap className="h-3.5 w-3.5 text-amber-500" />;
    case 'message':
      return <Send className="h-3.5 w-3.5 text-blue-500" />;
    case 'custom_event':
      return <Calendar className="h-3.5 w-3.5 text-purple-500" />;
  }
}

function getHistoryItemId(item: HistoryItem, idx: number): string {
  if (item.type === 'automation' && item.automation_id) return `auto-${item.automation_id}-${idx}`;
  if (item.type === 'message' && item.message_id) return `msg-${item.message_id}-${idx}`;
  if (item.type === 'custom_event' && item.event_id) return `evt-${item.event_id}-${idx}`;
  return `item-${idx}`;
}

interface ContactHistoryCardProps {
  contactId: number;
}

export const ContactHistoryCard = memo(function ContactHistoryCard({ contactId }: ContactHistoryCardProps) {
  const { t } = useTranslation();
  const [activityType, setActivityType] = useState('all');
  const [channel, setChannel] = useState('all');
  const [datePreset, setDatePreset] = useState('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  const filters = useMemo(() => {
    const dates =
      datePreset === 'custom'
        ? { startDate: customStartDate, endDate: customEndDate }
        : datePreset !== 'all'
          ? getDatePreset(datePreset)
          : {};
    return {
      activityType,
      channel: activityType === 'message' ? channel : undefined,
      ...dates,
    };
  }, [activityType, channel, datePreset, customStartDate, customEndDate]);

  const historyQuery = useContactHistory(contactId, filters);
  const historyItems = historyQuery.data?.pages.flat() ?? [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{t('contacts.activityHistory')}</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Select
            value={activityType}
            onValueChange={(v) => {
              setActivityType(v);
              setChannel('all');
            }}
          >
            <SelectTrigger className="h-8 w-[130px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">
                {t('contacts.historyFilterAll')}
              </SelectItem>
              <SelectItem value="automation" className="text-xs">
                {t('contacts.historyFilterAutomation')}
              </SelectItem>
              <SelectItem value="message" className="text-xs">
                {t('contacts.historyFilterMessage')}
              </SelectItem>
              <SelectItem value="custom_event" className="text-xs">
                {t('contacts.historyFilterCustomEvent')}
              </SelectItem>
            </SelectContent>
          </Select>

          {activityType === 'message' && (
            <Select value={channel} onValueChange={setChannel}>
              <SelectTrigger className="h-8 w-[130px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">
                  {t('contacts.historyFilterAll')}
                </SelectItem>
                <SelectItem value="email" className="text-xs">
                  Email
                </SelectItem>
                <SelectItem value="web-push" className="text-xs">
                  Web Push
                </SelectItem>
                <SelectItem value="mobile-push" className="text-xs">
                  Mobile Push
                </SelectItem>
                <SelectItem value="sms" className="text-xs">
                  SMS
                </SelectItem>
                <SelectItem value="whatsapp" className="text-xs">
                  WhatsApp
                </SelectItem>
              </SelectContent>
            </Select>
          )}

          <Select value={datePreset} onValueChange={setDatePreset}>
            <SelectTrigger className="h-8 w-[110px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">
                {t('contacts.historyFilterAll')}
              </SelectItem>
              <SelectItem value="today" className="text-xs">
                {t('contacts.historyFilterToday')}
              </SelectItem>
              <SelectItem value="7d" className="text-xs">
                {t('contacts.historyFilter7d')}
              </SelectItem>
              <SelectItem value="30d" className="text-xs">
                {t('contacts.historyFilter30d')}
              </SelectItem>
              <SelectItem value="custom" className="text-xs">
                {t('contacts.historyFilterCustom')}
              </SelectItem>
            </SelectContent>
          </Select>

          {datePreset === 'custom' && (
            <>
              <Input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="h-8 w-[130px] text-xs"
              />
              <Input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="h-8 w-[130px] text-xs"
              />
            </>
          )}
        </div>

        {/* History items */}
        {historyItems.length === 0 && !historyQuery.isLoading ? (
          <p className="text-muted-foreground text-sm">{t('contacts.noActivity')}</p>
        ) : (
          <div className="space-y-3">
            {historyItems.map((item, idx) => (
              <div
                key={getHistoryItemId(item, idx)}
                className="border-muted flex items-start gap-3 border-l-2 pb-3 pl-3 text-sm"
              >
                <div className="mt-0.5">{getHistoryItemIcon(item)}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {item.type === 'automation'
                        ? t('contacts.historyFilterAutomation')
                        : item.type === 'message'
                          ? t('contacts.historyFilterMessage')
                          : t('contacts.historyFilterCustomEvent')}
                    </Badge>
                    {item.event && (
                      <Badge variant="secondary" className="text-xs">
                        {item.event}
                      </Badge>
                    )}
                    {item.type === 'message' && item.message_type && (
                      <Badge variant="secondary" className="text-xs">
                        {item.message_type}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 font-medium">{getEventLabel(item)}</p>
                  <p className="text-muted-foreground text-xs">{getEventTime(item)}</p>
                </div>
              </div>
            ))}
            {historyQuery.hasNextPage && (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => historyQuery.fetchNextPage()}
                disabled={historyQuery.isFetchingNextPage}
              >
                {t('contacts.showMore')}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
});

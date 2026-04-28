import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, Copy, Check } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ListPage } from '@/components/list-page';
import { usePostmaster } from './use-postmaster';
import { DateRangePicker } from '@/components/date-range-picker';
import { IpReputationChart } from './components/ip-reputation-chart';
import { SpamRateChart } from './components/spam-rate-chart';
import { DomainReputationChart } from './components/domain-reputation-chart';
import { FeedbackLoopChart } from './components/feedback-loop-chart';
import { AuthChart } from './components/auth-chart';
import type { ChartType } from './types';

const POSTMASTER_EMAIL = 'bfp@brius.com.br';
const HELP_URL = 'https://etusmedia.atlassian.net/wiki/spaces/BHC/pages/1755807782/Google+Postmaster';

const CHART_TYPES: ChartType[] = ['ip', 'spam', 'domain', 'loop', 'auth'];

function getDefaultDateRange() {
  const today = new Date();
  return {
    startDate: format(subDays(today, 7), 'yyyy-MM-dd'),
    endDate: format(today, 'yyyy-MM-dd'),
  };
}

export default function PostmasterPage() {
  const { t } = useTranslation();

  const [dateRange, setDateRange] = useState(getDefaultDateRange);
  const [selectedDomain, setSelectedDomain] = useState<string | undefined>(undefined);
  const [chartType, setChartType] = useState<ChartType>('ip');
  const [copied, setCopied] = useState(false);

  const query = usePostmaster(dateRange.startDate, dateRange.endDate);
  const domains = useMemo(() => query.data?.map((d) => d.domain) ?? [], [query.data]);

  const activeDomain = selectedDomain ?? domains[0];
  const domainData = useMemo(() => query.data?.find((d) => d.domain === activeDomain), [query.data, activeDomain]);
  const dates = domainData?.dates ?? [];

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(POSTMASTER_EMAIL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  const handleDateChange = useCallback((from: string, to: string) => {
    setDateRange({ startDate: from, endDate: to });
  }, []);

  const hasData = domains.length > 0;

  return (
    <ListPage.Root>
      <ListPage.Header title={t('postmaster.pageTitle')} />

      <div>
        {/* Info banner */}
        <Card className="mb-6">
          <CardContent>
            <p className="font-semibold">{t('postmaster.verifyReputation')}</p>
            <p className="text-muted-foreground mt-1 text-sm">{t('postmaster.copyEmailInstruction')}</p>
            <div className="mt-3 flex items-center gap-3">
              <input
                type="text"
                readOnly
                value={POSTMASTER_EMAIL}
                className="bg-muted flex-1 rounded-md border px-3 py-2 text-sm"
              />
              <Button variant="outline" size="sm" onClick={handleCopy}>
                {copied ? <Check className="mr-1 h-4 w-4" /> : <Copy className="mr-1 h-4 w-4" />}
                {copied ? t('postmaster.copied') : t('postmaster.copy')}
              </Button>
            </div>
            <p className="text-muted-foreground mt-2 text-sm">
              {
                t('postmaster.helpPageText', {
                  link: '',
                }).split('<link>')[0]
              }
              <a href={HELP_URL} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                {t('postmaster.helpPageText').match(/<link>(.*?)<\/link>/)?.[1] ?? ''}
              </a>
              {t('postmaster.helpPageText').split('</link>')[1] ?? ''}
            </p>
          </CardContent>
        </Card>

        {query.isLoading ? (
          <div className="grid gap-6 p-6 md:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <div className="bg-muted h-4 w-24 animate-pulse rounded" />
                </CardHeader>
                <CardContent>
                  <div className="bg-muted h-8 w-16 animate-pulse rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : !hasData ? (
          <div className="text-muted-foreground flex flex-col items-center justify-center py-16">
            <Globe className="mb-4 h-12 w-12" />
            <p>{t('postmaster.noDomains')}</p>
          </div>
        ) : (
          <>
            {/* Filters toolbar */}
            <div className="mb-6 flex flex-wrap items-center gap-3">
              <div data-testid="domain-selector">
                <Select value={activeDomain ?? ''} onValueChange={setSelectedDomain}>
                  <SelectTrigger className="w-[250px]">
                    <SelectValue placeholder={t('postmaster.selectDomain')} />
                  </SelectTrigger>
                  <SelectContent>
                    {domains.map((domain) => (
                      <SelectItem key={domain} value={domain}>
                        {domain}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div data-testid="chart-type-selector">
                <Select value={chartType} onValueChange={(v) => setChartType(v as ChartType)}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CHART_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {t(`postmaster.chartType_${type}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <DateRangePicker from={dateRange.startDate} to={dateRange.endDate} onChange={handleDateChange} />
            </div>

            {/* Chart area */}
            {dates.length === 0 ? (
              <div className="text-muted-foreground flex flex-col items-center justify-center py-16">
                <Globe className="mb-4 h-12 w-12" />
                <p className="font-semibold">{t('postmaster.noData')}</p>
                <p className="text-sm">{t('postmaster.noDataPeriod')}</p>
                <p className="text-sm">{t('postmaster.selectNewPeriod')}</p>
              </div>
            ) : (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium">{t(`postmaster.chartType_${chartType}`)}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {chartType === 'ip' && <IpReputationChart dates={dates} />}
                    {chartType === 'spam' && <SpamRateChart dates={dates} />}
                    {chartType === 'domain' && <DomainReputationChart dates={dates} />}
                    {chartType === 'loop' && <FeedbackLoopChart dates={dates} />}
                    {chartType === 'auth' && <AuthChart dates={dates} />}
                  </CardContent>
                </Card>
              </>
            )}
          </>
        )}
      </div>
    </ListPage.Root>
  );
}

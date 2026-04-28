import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Eye, ExternalLink, Trophy } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ConfirmDialog } from '@/components/confirm-dialog';
import StatisticsCard from './statistics-card';
import { MessagePreviewDialog } from '@/components/message-preview-dialog';
import {
  useCampaignStatistics,
  useCampaignStatisticsTestAB,
  useCampaignDashboardStats,
  useStopCampaign,
} from './use-campaigns';
import { CampaignStatus, CAMPAIGN_STATUS_LABELS, SPREAD_SENDING_OPTIONS, RecurrenceFrequency } from './types';
import type { Campaign, DashboardGeneralStats } from './types';
import { formatCampaignDate, formatCampaignTime, extractLinks } from './utils';

interface ProcessCampaignProps {
  campaign: Campaign;
}

export default function ProcessCampaign({ campaign }: ProcessCampaignProps) {
  const { t } = useTranslation();
  // API may return steps as JSON string — parse it safely
  const parsedSteps: Campaign['steps'] = (() => {
    if (Array.isArray(campaign.steps)) return campaign.steps;
    if (typeof campaign.steps === 'string') {
      try {
        return JSON.parse(campaign.steps);
      } catch {
        return [];
      }
    }
    return [];
  })();

  const isTestAB = campaign.type === 'testAB';
  const isSending = campaign.status === CampaignStatus.Sending || campaign.status === CampaignStatus.SendingTestAb;
  const isSendingTestAb = campaign.status === CampaignStatus.SendingTestAb;

  const { data: redisStats } = useCampaignStatistics([campaign.id], isSending);
  const { data: dashboardStats } = useCampaignDashboardStats(
    campaign.id,
    campaign.messageType,
    campaign.scheduleTo,
    isSending,
  );

  // API returns campaignMessage as { message: {...}, statistics: {...}, winner: boolean, messageId }
  // Normalize to flat structure for rendering, preserving messageId as fallback for id
  const rawMessages = (campaign.campaignMessage ?? []).map((item: any) => ({
    ...(item.message ?? item),
    id: item.message?.id ?? item.messageId ?? item.id,
    statistics: item.statistics ?? (item as any).statistics,
    winner: item.winner,
  }));

  const messagesIds = rawMessages.filter((m) => m.id).map((m) => m.id as number);
  const { data: testAbStats } = useCampaignStatisticsTestAB(isTestAB ? campaign.id : 0, messagesIds, isSendingTestAb);

  // Normalize message statistics: raw counts → percentages for display
  // TestAB campaigns may have real-time stats overlay from Redis
  const messages = rawMessages.map((msg) => {
    // For testAB: prefer real-time stats from the statistics-testab endpoint
    const rawStats = (isTestAB && testAbStats?.[msg.id]) || msg.statistics;
    if (!rawStats) return msg;

    const delivered = Number(rawStats.delivered) || Number(rawStats.total) || 0;
    const open = Number(rawStats.open) || 0;
    const click = Number(rawStats.click) || 0;

    // If stats already have openRate (precomputed), use them; otherwise compute from raw counts
    const hasRates = rawStats.openRate !== undefined;
    return {
      ...msg,
      statistics: {
        delivered,
        openRate: hasRates ? rawStats.openRate : delivered > 0 ? Number(((open / delivered) * 100).toFixed(1)) : 0,
        clickRate: hasRates ? rawStats.clickRate : delivered > 0 ? Number(((click / delivered) * 100).toFixed(1)) : 0,
        ctrOrRate: hasRates ? rawStats.ctrOrRate : open > 0 ? Number(((click / open) * 100).toFixed(1)) : 0,
      },
    };
  });
  const stopCampaign = useStopCampaign();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [stopDialogOpen, setStopDialogOpen] = useState(false);

  // Determine winner for TestAB campaigns
  const showWinnerSection = isTestAB && !isSendingTestAb && messages.length > 0;
  const winnerMessage = isTestAB ? getWinnerMessage(messages, campaign.testabCriteria) : null;

  // Progress: prefer Redis real-time data over Postgres static value
  const redisEntry = redisStats?.[0];
  const sentPercentage = Number(redisEntry?.sentPercentage) || Number(campaign.sentPercentage) || 0;

  const statusLabel = CAMPAIGN_STATUS_LABELS[campaign.status];
  const statusVariant = getStatusVariant(campaign.status);

  return (
    <div className="space-y-6" data-testid="process-campaign">
      {/* Status badge + optional description (title is rendered by FormPage.Header) */}
      <div className="flex items-center justify-between">
        {campaign.description ? <p className="text-muted-foreground text-sm">{campaign.description}</p> : <div />}
        <Badge variant={statusVariant}>{t(statusLabel as never)}</Badge>
      </div>

      {/* Progress bar (when sending) */}
      {isSending && (
        <div data-testid="campaign-progress">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-muted-foreground text-sm">{t('campaigns.progressLabel')}</span>
            <span className="text-sm font-medium">{sentPercentage}%</span>
          </div>
          <div className="bg-muted h-2 w-full rounded-full">
            <div
              className="bg-primary h-2 rounded-full transition-all"
              style={{ width: `${Math.min(sentPercentage, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Statistics Grid — dashboard aggregate stats */}
      {dashboardStats && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4" data-testid="campaign-statistics">
          {renderStatisticsCards(dashboardStats, campaign.messageType, t as never)}
        </div>
      )}

      {/* Settings Section */}
      <Card data-testid="process-settings">
        <CardHeader>
          <CardTitle className="text-base">{t('campaigns.processSettings')}</CardTitle>
        </CardHeader>
        <CardContent>
          {isTestAB ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                <div>
                  <p className="text-muted-foreground text-xs">{t('campaigns.testabCriteriaLabel')}</p>
                  <p className="text-sm font-medium">
                    {campaign.testabCriteria === 'click'
                      ? t('campaigns.testabCriteriaClick')
                      : t('campaigns.testabCriteriaOpen')}
                  </p>
                </div>
                {messages.length > 0 && (
                  <div>
                    <p className="text-muted-foreground text-xs">{t('campaigns.reviewTestSample')}</p>
                    <div className="flex flex-wrap gap-2 text-sm">
                      {messages.map((_, i) => (
                        <span key={i}>
                          {t('campaigns.messageLabel', { label: String.fromCharCode(65 + i) })}:{' '}
                          <strong>{((campaign.testabAudiencePercent ?? 10) / messages.length).toFixed(1)}%</strong>
                        </span>
                      ))}
                      <span>
                        {t('campaigns.winnerMessage')}: <strong>{100 - (campaign.testabAudiencePercent ?? 10)}%</strong>
                      </span>
                    </div>
                  </div>
                )}
              </div>
              <Separator />
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {campaign.testabScheduleTo && (
                  <div>
                    <p className="text-muted-foreground text-xs">{t('campaigns.processTestSchedule')}</p>
                    <p className="text-sm">
                      {t('campaigns.reviewDayAt', {
                        date: formatCampaignDate(campaign.testabScheduleTo),
                        time: formatCampaignTime(campaign.testabScheduleTo),
                      })}
                      {campaign.spreadSending ? ` (${getSpreadLabel(campaign.spreadSending, t as never)})` : ''}
                    </p>
                  </div>
                )}
                {campaign.testabSentAfterTest && campaign.scheduleTo && (
                  <div>
                    <p className="text-muted-foreground text-xs">{t('campaigns.processWinnerSchedule')}</p>
                    <p className="text-sm">
                      {t('campaigns.reviewDayAt', {
                        date: formatCampaignDate(campaign.scheduleTo),
                        time: formatCampaignTime(campaign.scheduleTo),
                      })}
                      {campaign.spreadSending ? ` (${getSpreadLabel(campaign.spreadSending, t as never)})` : ''}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : campaign.type === 'recurring' ? (
            <div className="grid grid-cols-2 gap-4">
              {campaign.recurrenceSettings?.date && (
                <div>
                  <p className="text-muted-foreground text-xs">{t('campaigns.recurrenceDate')}</p>
                  <p className="text-sm">
                    {t('campaigns.reviewDayAt', {
                      date: formatCampaignDate(campaign.recurrenceSettings.date),
                      time: formatCampaignTime(campaign.recurrenceSettings.date),
                    })}
                  </p>
                </div>
              )}
              <div>
                <p className="text-muted-foreground text-xs">{t('campaigns.recurrenceInterval')}</p>
                <p className="text-sm">
                  {campaign.recurrenceSettings?.interval ?? 1}{' '}
                  {getFrequencyLabel(campaign.recurrenceSettings?.frequency, t as never)}
                </p>
              </div>
              {campaign.recurrenceSettings?.frequency === RecurrenceFrequency.Weekly && (
                <div>
                  <p className="text-muted-foreground text-xs">{t('campaigns.weekDaysLabel')}</p>
                  <p className="text-sm">
                    {campaign.recurrenceSettings?.weekDays?.map(formatWeekDay).join(', ') || '-'}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div>
              <p className="text-muted-foreground text-xs">{t('campaigns.processScheduleLabel')}</p>
              <p className="text-sm">
                {campaign.sendAfterCreate
                  ? t('campaigns.sendNow')
                  : campaign.scheduleTo
                    ? t('campaigns.reviewDayAt', {
                        date: formatCampaignDate(campaign.scheduleTo),
                        time: formatCampaignTime(campaign.scheduleTo),
                      })
                    : '-'}
                {campaign.spreadSending && !campaign.sendAfterCreate
                  ? ` (${getSpreadLabel(campaign.spreadSending, t as never)})`
                  : ''}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Winner section — shown for TestAB campaigns after test phase */}
      {showWinnerSection && winnerMessage && (
        <div data-testid="winner-section">
          <h3 className="mb-3 flex items-center gap-2 text-base font-semibold">
            <Trophy className="h-5 w-5 text-yellow-500" />
            {t('campaigns.winnerMessage')}
          </h3>
          <Card className="border-green-500">
            <CardContent className="p-4">
              <p className="text-sm font-medium">{winnerMessage.title || '-'}</p>
              {winnerMessage.subject && (
                <p className="text-muted-foreground mt-0.5 text-xs">
                  {t('campaigns.reviewSubject')}: {winnerMessage.subject}
                </p>
              )}
              {winnerMessage.statistics && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {winnerMessage.statistics.openRate !== undefined && (
                    <div className="rounded border border-green-500 px-2 py-1 text-center text-xs">
                      <p className="text-muted-foreground">{t('campaigns.statisticsOpens')}</p>
                      <p className="font-semibold text-green-600">{winnerMessage.statistics.openRate}%</p>
                    </div>
                  )}
                  {winnerMessage.statistics.clickRate !== undefined && (
                    <div className="rounded border border-green-500 px-2 py-1 text-center text-xs">
                      <p className="text-muted-foreground">{t('campaigns.statisticsClicks')}</p>
                      <p className="font-semibold text-green-600">{winnerMessage.statistics.clickRate}%</p>
                    </div>
                  )}
                  {winnerMessage.statistics.ctrOrRate !== undefined && (
                    <div className="rounded border px-2 py-1 text-center text-xs">
                      <p className="text-muted-foreground">CTR/OR</p>
                      <p className="font-semibold">{winnerMessage.statistics.ctrOrRate}%</p>
                    </div>
                  )}
                </div>
              )}
              {winnerMessage.statistics?.delivered !== undefined && (
                <p className="text-muted-foreground mt-2 text-xs">
                  {t('campaigns.processDelivered')}: {winnerMessage.statistics.delivered.toLocaleString()}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Messages */}
      {messages.length > 0 && (
        <div data-testid="process-messages">
          <h3 className="mb-3 text-base font-semibold">
            {isTestAB
              ? `Test A/B: ${campaign.status !== CampaignStatus.SendingTestAb ? t('campaigns.processCompleted') : ''}`
              : campaign.type === 'split'
                ? `${t('campaigns.processCampaignSplit')}:`
                : campaign.type === 'recurring'
                  ? `${t('campaigns.processCampaignRecurring')}:`
                  : `${t('campaigns.processRegularCampaign')}:`}
          </h3>
          <div
            className={isTestAB || campaign.type === 'split' ? 'grid grid-cols-1 gap-3 md:grid-cols-2' : 'space-y-3'}
          >
            {messages.map((msg, i) => {
              const isCompleted = campaign.status === CampaignStatus.Completed;
              const isMsgSending =
                campaign.status === CampaignStatus.Sending || campaign.status === CampaignStatus.SendingTestAb;
              const isWinner = isTestAB && winnerMessage?.id === msg.id;
              const isLoser = isTestAB && !isWinner && !isSendingTestAb;
              const samplePercent =
                isTestAB || campaign.type === 'split'
                  ? ((campaign.testabAudiencePercent ?? 10) / messages.length).toFixed(1)
                  : null;
              const criterion = campaign.testabCriteria ?? 'open';

              const msgLinks = msg.content ? extractLinks(msg.content) : [];
              const msgUrl = ['web-push', 'sms', 'whatsapp'].includes(campaign.messageType) ? msg.url : null;

              return (
                <Card key={i} data-testid={`message-card-${i}`} className={isWinner ? 'border-green-500' : ''}>
                  <CardContent className="p-4">
                    {/* Header: title + status + preview */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">
                          {t('campaigns.messageLabel', { label: String.fromCharCode(65 + i) })}: {msg.title || '-'}
                        </p>
                        {msg.subject && (
                          <p className="text-muted-foreground mt-0.5 text-xs">
                            {t('campaigns.reviewSubject')}: {msg.subject}
                          </p>
                        )}
                        {(msg.fromName || msg.fromMail) && (
                          <p className="text-muted-foreground text-xs">
                            {msg.fromName} {msg.fromMail && `<${msg.fromMail}>`}
                          </p>
                        )}
                        {/* Extracted links */}
                        {(msgLinks.length > 0 || msgUrl) && (
                          <div className="text-muted-foreground mt-1 text-xs">
                            <span className="font-medium">{t('campaigns.processLinks')}</span>{' '}
                            {msgUrl ? (
                              <a
                                href={msgUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline"
                              >
                                {msgUrl}
                              </a>
                            ) : (
                              msgLinks.map((link, li) => (
                                <a
                                  key={li}
                                  href={link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary block truncate hover:underline"
                                >
                                  {link}
                                </a>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        {isCompleted && (isTestAB || campaign.type === 'split') && (
                          <Badge variant="secondary" className="gap-1 text-xs">
                            {t('campaigns.processSent')}
                          </Badge>
                        )}
                        {isMsgSending && (isTestAB || campaign.type === 'split') && (
                          <Badge variant="outline" className="text-xs">
                            {t('campaigns.processSending')}
                          </Badge>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          data-testid={`preview-btn-${i}`}
                          title={t('campaigns.processViewMessage')}
                          onClick={() => {
                            setPreviewIndex(i);
                            setPreviewOpen(true);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Statistics grid */}
                    {msg.statistics && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {samplePercent && (
                          <div className="rounded border border-dashed border-purple-400 px-2 py-1 text-center text-xs">
                            <p className="text-muted-foreground">{t('campaigns.processSample')}</p>
                            <p className="font-semibold">{samplePercent}%</p>
                          </div>
                        )}
                        {msg.statistics.openRate !== undefined && (
                          <div
                            className={`rounded border px-2 py-1 text-center text-xs ${
                              isTestAB && criterion === 'open' && isWinner
                                ? 'border-green-500'
                                : isTestAB && criterion === 'open' && isLoser
                                  ? 'border-red-500'
                                  : ''
                            }`}
                            {...(isLoser && criterion === 'open' ? { 'data-stat-loss': 'true' } : {})}
                          >
                            <p className="text-muted-foreground">{t('campaigns.statisticsOpens')}</p>
                            <p
                              className={`font-semibold ${
                                isTestAB && criterion === 'open' && isWinner
                                  ? 'text-green-600'
                                  : isTestAB && criterion === 'open' && isLoser
                                    ? 'text-red-600'
                                    : ''
                              }`}
                            >
                              {msg.statistics.openRate}%
                            </p>
                          </div>
                        )}
                        {msg.statistics.clickRate !== undefined && (
                          <div
                            className={`rounded border px-2 py-1 text-center text-xs ${
                              isTestAB && criterion === 'click' && isWinner
                                ? 'border-green-500'
                                : isTestAB && criterion === 'click' && isLoser
                                  ? 'border-red-500'
                                  : ''
                            }`}
                            {...(isLoser && criterion === 'click' ? { 'data-stat-loss': 'true' } : {})}
                          >
                            <p className="text-muted-foreground">{t('campaigns.statisticsClicks')}</p>
                            <p
                              className={`font-semibold ${
                                isTestAB && criterion === 'click' && isWinner
                                  ? 'text-green-600'
                                  : isTestAB && criterion === 'click' && isLoser
                                    ? 'text-red-600'
                                    : ''
                              }`}
                            >
                              {msg.statistics.clickRate}%
                            </p>
                          </div>
                        )}
                        {msg.statistics.ctrOrRate !== undefined && (
                          <div className="rounded border px-2 py-1 text-center text-xs">
                            <p className="text-muted-foreground">CTR/OR</p>
                            <p className="font-semibold">{msg.statistics.ctrOrRate}%</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Total delivered */}
                    {msg.statistics?.delivered !== undefined && (
                      <p className="text-muted-foreground mt-2 text-xs">
                        {t('campaigns.processDelivered')}: {msg.statistics.delivered.toLocaleString()}
                      </p>
                    )}

                    {/* More Statistics link */}
                    {msg.id && (
                      <div className="mt-3 flex justify-end">
                        <a
                          href={`/messages/${campaign.messageType}/statistics?messages=${msg.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          data-testid={`more-stats-link-${i}`}
                          className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-1 rounded px-3 py-1.5 text-xs font-semibold"
                        >
                          {t('campaigns.processMoreStatistics')}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Audience Section */}
      <Card data-testid="process-audience">
        <CardHeader>
          <CardTitle className="text-base">{t('campaigns.reviewAudience')}</CardTitle>
        </CardHeader>
        <CardContent>
          {campaign.sendToAll ? (
            <p className="text-sm">{t('campaigns.sendToAllLabel')}</p>
          ) : (parsedSteps ?? []).length > 0 ? (
            <div className="space-y-2">
              {(parsedSteps ?? []).map((card, cardIndex) => {
                const hasCC = card[0]?.type === 'conditionalCard';
                const ccValue = hasCC ? card[0]?.value : null;
                const tagSteps = hasCC ? card.slice(1) : card;

                return (
                  <div key={cardIndex}>
                    {cardIndex > 0 && ccValue && (
                      <div className="flex justify-center py-1">
                        <Badge variant="outline" className="text-xs">
                          {ccValue === 'EXCEPT' ? t('campaigns.audienceExclude') : t('campaigns.audienceInclude')}
                        </Badge>
                      </div>
                    )}
                    <div className="space-y-1 rounded border p-2">
                      {tagSteps.map((step, stepIndex) => {
                        const tagNames = (step.tag_info ?? []).map((tg) => tg.name);
                        const conditionalTag =
                          step.conditional_tag === 'not in'
                            ? t('campaigns.audienceHasNot')
                            : t('campaigns.audienceHas');
                        return (
                          <div key={stepIndex}>
                            {stepIndex > 0 && step.conditional && (
                              <p className="text-muted-foreground py-0.5 text-center text-[11px]">
                                {step.conditional === 'EXCEPT'
                                  ? t('campaigns.audienceExclude')
                                  : t('campaigns.audienceInclude')}
                              </p>
                            )}
                            <div className="flex flex-wrap items-center gap-1">
                              <Badge variant="outline" className="text-[11px]">
                                {conditionalTag}
                              </Badge>
                              {tagNames.length > 0 ? (
                                tagNames.map((name) => (
                                  <Badge key={name} variant="secondary" className="text-[11px]">
                                    {name}
                                  </Badge>
                                ))
                              ) : (
                                <Badge variant="secondary" className="text-[11px]">
                                  {(step.tag_id ?? []).length} tag
                                  {(step.tag_id ?? []).length !== 1 ? 's' : ''}
                                </Badge>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">-</p>
          )}
        </CardContent>
      </Card>

      {/* Stop button */}
      {isSending && (
        <>
          <Button
            variant="destructive"
            disabled={stopCampaign.isPending}
            data-testid="stop-campaign-btn"
            onClick={() => setStopDialogOpen(true)}
          >
            {t('campaigns.stopCampaign')}
          </Button>
          <ConfirmDialog
            open={stopDialogOpen}
            onOpenChange={setStopDialogOpen}
            title={t('campaigns.stopCampaign')}
            description={t('campaigns.stopConfirm')}
            onConfirm={() => {
              stopCampaign.mutate(campaign.id);
              setStopDialogOpen(false);
            }}
            loading={stopCampaign.isPending}
          />
        </>
      )}

      {/* Message Preview Dialog */}
      {messagesIds.length > 0 && (
        <MessagePreviewDialog
          messageIds={messagesIds}
          initialIndex={previewIndex}
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          filterId={campaign.id}
          filterType="campaign"
        />
      )}
    </div>
  );
}

function getSpreadLabel(minutes: number, t: (key: string, params?: Record<string, unknown>) => string): string {
  const opt = SPREAD_SENDING_OPTIONS.find((o) => o.value === minutes);
  if (!opt) return `${minutes}min`;
  return 'labelParams' in opt ? t(opt.labelKey, opt.labelParams as Record<string, unknown>) : t(opt.labelKey);
}

function getFrequencyLabel(freq: number | null | undefined, t: (key: string) => string): string {
  if (freq === RecurrenceFrequency.Daily) return t('campaigns.frequencyDailyPlural');
  if (freq === RecurrenceFrequency.Weekly) return t('campaigns.frequencyWeeklyPlural');
  if (freq === RecurrenceFrequency.Monthly) return t('campaigns.frequencyMonthlyPlural');
  return '';
}

function formatWeekDay(day: number): string {
  const labels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  return labels[day] ?? String(day);
}

function formatPercent(value: number, total: number): string {
  if (!total || total === 0) return '0.00';
  return ((value / total) * 100).toFixed(2);
}

function renderStatisticsCards(stats: DashboardGeneralStats, messageType: string, t: (key: string) => string) {
  const isPush = messageType === 'web-push' || messageType === 'mobile-push';
  const isEmail = messageType === 'email';
  const cards: React.ReactNode[] = [];

  if (isPush) {
    // Push: Total (sent), Entregue (delivered/sent%), Cliques (click/delivered%)
    cards.push(
      <StatisticsCard key="total" label="Total" value={stats.sent ?? 0} />,
      <StatisticsCard
        key="delivered"
        label={t('campaigns.statisticsDelivered')}
        value={stats.delivered ?? 0}
        suffix={`(${formatPercent(stats.delivered, stats.sent)}%)`}
      />,
      <StatisticsCard
        key="clicks"
        label={t('campaigns.statisticsClicks')}
        value={stats.click ?? 0}
        suffix={`(${formatPercent(stats.click, stats.delivered)}%)`}
      />,
    );
    if (messageType === 'web-push') {
      cards.push(
        <StatisticsCard
          key="close"
          label="Close"
          value={stats.close ?? 0}
          suffix={`(${formatPercent(stats.close, stats.delivered)}%)`}
        />,
      );
    }
  } else {
    // Email/SMS: Total (delivered), Aberturas (open/delivered%), Cliques (click/delivered%)
    cards.push(
      <StatisticsCard key="total" label="Total" value={stats.delivered ?? 0} />,
      <StatisticsCard
        key="opens"
        label={t('campaigns.statisticsOpens')}
        value={stats.open ?? 0}
        suffix={`(${formatPercent(stats.open, stats.delivered)}%)`}
      />,
      <StatisticsCard
        key="clicks"
        label={t('campaigns.statisticsClicks')}
        value={stats.click ?? 0}
        suffix={`(${formatPercent(stats.click, stats.delivered)}%)`}
      />,
    );
    if (isEmail) {
      cards.push(
        <StatisticsCard
          key="unsubs"
          label={t('campaigns.statisticsUnsubscribes')}
          value={stats.unsubscribe ?? 0}
          suffix={`(${formatPercent(stats.unsubscribe, stats.delivered)}%)`}
        />,
        <StatisticsCard
          key="bounces"
          label="Bounce"
          value={stats.bounce ?? 0}
          suffix={`(${formatPercent(stats.bounce, stats.delivered)}%)`}
        />,
      );
    }
  }

  return cards;
}

function getWinnerMessage(
  messages: Array<Record<string, any>>,
  criteria?: 'open' | 'click',
): Record<string, any> | null {
  // 1. Explicit winner flag from backend
  const explicit = messages.find((m) => m.winner === true);
  if (explicit) return explicit;

  // 2. Calculate by comparing criterion stat values
  if (!criteria || messages.length === 0) return messages[0] ?? null;
  let best = messages[0];
  let bestVal = -1;
  for (const msg of messages) {
    const val = criteria === 'open' ? (msg.statistics?.openRate ?? 0) : (msg.statistics?.clickRate ?? 0);
    if (val > bestVal) {
      bestVal = val;
      best = msg;
    }
  }
  return best;
}

function getStatusVariant(status: CampaignStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case CampaignStatus.Sending:
    case CampaignStatus.SendingTestAb:
      return 'default';
    case CampaignStatus.Completed:
      return 'secondary';
    case CampaignStatus.Stopped:
      return 'destructive';
    default:
      return 'outline';
  }
}

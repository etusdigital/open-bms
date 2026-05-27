import { useState } from 'react';
import { type UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Eye } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import type { CampaignFormValues } from '../campaign-schema';
import { CHANNEL_OPTIONS, TYPE_OPTIONS, RecurrenceFrequency, SPREAD_SENDING_OPTIONS } from '../types';
import type { CampaignMessage } from '../types';
import { formatCampaignDate, formatCampaignTime } from '../utils';
import { MessagePreviewDialog } from '@/components/message-preview-dialog';

interface ReviewStepProps {
  form: UseFormReturn<CampaignFormValues>;
  isCampaignRule?: boolean;
  isTemplateCampaign?: boolean;
}

export default function ReviewStep({ form, isCampaignRule = false, isTemplateCampaign = false }: ReviewStepProps) {
  const { t } = useTranslation();
  const values = form.getValues();
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  const channelLabel = CHANNEL_OPTIONS.find((c) => c.value === values.messageType)?.labelKey ?? values.messageType;
  const typeLabel = TYPE_OPTIONS.find((o) => o.value === values.type)?.labelKey ?? '';

  const isTestAB = values.type === 'testAB';
  const isRecurring = values.type === 'recurring';
  const messages = values.campaignMessage ?? [];
  const steps = values.steps ?? [];
  const testabAudiencePercent = values.testabAudiencePercent ?? 10;

  return (
    <div className="space-y-6" data-testid="review-step">
      {!isCampaignRule && !isTemplateCampaign && <h3 className="text-lg font-medium">{t('campaigns.reviewTitle')}</h3>}

      {/* General Section — hidden for template campaigns */}
      {!isTemplateCampaign && (
        <>
          <div>
            <h4 className="text-muted-foreground mb-2 text-sm font-medium">{t('campaigns.reviewGeneral')}</h4>
            <div className="grid gap-2">
              <ReviewRow label={t('campaigns.title')} value={values.title} />
              {values.name && <ReviewRow label={t('campaigns.utmName')} value={values.name} />}
              <ReviewRow label={t('campaigns.description')} value={values.description || '-'} />
              <ReviewRow label={t('campaigns.channelLabel')} value={t(channelLabel as never)} />
              <ReviewRow label={t('campaigns.typeLabel')} value={t(typeLabel as never)} />
            </div>
          </div>

          <Separator />
        </>
      )}

      {/* Audience Section */}
      <div>
        <h4 className="text-muted-foreground mb-2 text-sm font-medium">{t('campaigns.reviewAudience')}</h4>
        <ReviewRow
          label={t('campaigns.sendToAllLabel')}
          value={values.sendToAll ? t('campaigns.sendToAllLabel') : t('campaigns.sendToTagsLabel')}
        />
        {!values.sendToAll && steps.length > 0 && (
          <div className="mt-2 space-y-2">
            {steps.map((card, cardIndex) => {
              const hasCC = card[0]?.type === 'conditionalCard';
              const ccValue = hasCC ? card[0]?.value : null;
              const tagSteps = hasCC ? card.slice(1) : card;

              return (
                <div key={cardIndex}>
                  {/* Card-level conditional badge */}
                  {cardIndex > 0 && ccValue && (
                    <div className="flex justify-center py-1">
                      <Badge variant="outline" className="text-xs">
                        {ccValue === 'EXCEPT' ? t('campaigns.audienceExclude') : t('campaigns.audienceInclude')}
                      </Badge>
                    </div>
                  )}
                  {/* Tag steps within the card */}
                  <div className="space-y-1 rounded border p-2">
                    {tagSteps.map((step, stepIndex) => {
                      const tagNames = (step.tag_info ?? []).map((t) => t.name);
                      const conditionalTag =
                        step.conditional_tag === 'not in' ? t('campaigns.audienceHasNot') : t('campaigns.audienceHas');
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
        )}
      </div>

      {/* Content Section (hidden for campaign rules and template campaigns) */}
      {!isCampaignRule && !isTemplateCampaign && (
        <>
          <Separator />
          <div>
            <h4 className="text-muted-foreground mb-2 text-sm font-medium">{t('campaigns.reviewContent')}</h4>
            {messages.length === 0 ? (
              <p className="text-muted-foreground text-sm">-</p>
            ) : (
              <div className="space-y-2">
                {messages.map((msg, i) => (
                  <div key={i} className="flex items-start justify-between gap-2 rounded border p-2 text-sm">
                    <div className="min-w-0 flex-1">
                      <ChannelContent message={msg} messageType={values.messageType} t={t as never} />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      onClick={() => setPreviewIndex(i)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Warning for A/B with < 2 messages */}
            {(isTestAB || values.type === 'split') && messages.filter((m) => m.id || m.messageId).length < 2 && (
              <Alert variant="destructive" className="mt-2">
                <AlertDescription>{t('campaigns.minTwoMessages')}</AlertDescription>
              </Alert>
            )}
          </div>
        </>
      )}

      <Separator />

      {/* Schedule Section */}
      <div>
        <h4 className="text-muted-foreground mb-2 text-sm font-medium">{t('campaigns.reviewSchedule')}</h4>

        {isRecurring ? (
          <div className="grid gap-2">
            {values.recurrenceSettings?.date && (
              <ReviewRow label={t('campaigns.recurrenceDate')} value={values.recurrenceSettings.date} />
            )}
            <ReviewRow
              label={t('campaigns.recurrenceInterval')}
              value={`${values.recurrenceSettings?.interval ?? 1} ${getFrequencyText(
                values.recurrenceSettings?.frequency,
                t as never,
              )}`}
            />
            {values.recurrenceSettings?.frequency === RecurrenceFrequency.Weekly && (
              <ReviewRow
                label={t('campaigns.weekDaysLabel')}
                value={values.recurrenceSettings?.weekDays?.map(formatWeekDay).join(', ') || '-'}
              />
            )}
            <ReviewRow
              label={t('campaigns.expirationLabel')}
              value={
                !values.recurrenceSettings?.hasExpiration
                  ? t('campaigns.expirationNever')
                  : values.recurrenceSettings?.untilDate
                    ? `${t('campaigns.expirationDate')}: ${values.recurrenceSettings.untilDate}`
                    : `${t('campaigns.expirationCount')}: ${values.recurrenceSettings?.untilSend} ${t('campaigns.expirationSends')}`
              }
            />
          </div>
        ) : isTestAB ? (
          <div className="grid gap-2">
            <ReviewRow
              label={t('campaigns.testabCriteriaLabel')}
              value={
                values.testabCriteria === 'click'
                  ? t('campaigns.testabCriteriaClick')
                  : t('campaigns.testabCriteriaOpen')
              }
            />
            <ReviewRow
              label={t('campaigns.reviewTestSample')}
              value={buildTestSampleLabel(messages, testabAudiencePercent, t as never)}
            />
            {values.testabScheduleTo && (
              <ReviewRow
                label={t('campaigns.reviewTestSchedule')}
                value={t('campaigns.reviewDayAt', {
                  date: formatCampaignDate(values.testabScheduleTo),
                  time: formatCampaignTime(values.testabScheduleTo),
                })}
              />
            )}
            {values.testabScheduleEnd && (
              <ReviewRow
                label={t('campaigns.testabScheduleEnd')}
                value={t('campaigns.reviewDayAt', {
                  date: formatCampaignDate(values.testabScheduleEnd),
                  time: formatCampaignTime(values.testabScheduleEnd),
                })}
              />
            )}
            {values.testabSentAfterTest && values.scheduleTo && (
              <ReviewRow
                label={t('campaigns.reviewWinnerSchedule')}
                value={t('campaigns.reviewDayAt', {
                  date: formatCampaignDate(values.scheduleTo),
                  time: formatCampaignTime(values.scheduleTo),
                })}
              />
            )}
          </div>
        ) : (
          <div className="grid gap-2">
            <ReviewRow
              label={t('campaigns.reviewSendCampaign')}
              value={
                values.sendAfterCreate
                  ? t('campaigns.sendNow')
                  : values.scheduleTo
                    ? t('campaigns.reviewDayAt', {
                        date: formatCampaignDate(values.scheduleTo),
                        time: formatCampaignTime(values.scheduleTo),
                      })
                    : '-'
              }
            />
          </div>
        )}

        {/* Spread sending — always show (including "Sem intervalo") */}
        {values.messageType !== 'web-push' && (
          <div className="mt-2">
            <ReviewRow
              label={t('campaigns.spreadSendingLabel')}
              value={getSpreadLabel(values.spreadSending ?? 0, t as never)}
            />
          </div>
        )}
      </div>

      {/* Message preview dialog */}
      {previewIndex !== null && (
        <MessagePreviewDialog
          messageIds={(messages as CampaignMessage[]).filter((m) => m.id).map((m) => m.id as number)}
          initialIndex={previewIndex}
          open={true}
          onOpenChange={(open) => {
            if (!open) setPreviewIndex(null);
          }}
        />
      )}
    </div>
  );
}

/** Channel-specific content rendering for review cards */
function ChannelContent({
  message,
  messageType,
  t,
}: {
  message: CampaignFormValues['campaignMessage'][number];
  messageType: string;
  t: (key: string, params?: Record<string, unknown>) => string;
}) {
  switch (messageType) {
    case 'email':
      return (
        <>
          <p className="font-medium">{message.title || message.subject || '-'}</p>
          {message.subject && (
            <p className="text-muted-foreground text-xs">
              {t('campaigns.reviewSubject')}: {message.subject}
            </p>
          )}
          {(message.fromName || message.fromMail) && (
            <p className="text-muted-foreground text-xs">
              {t('campaigns.reviewSender')}: {message.fromName} {message.fromMail && `<${message.fromMail}>`}
            </p>
          )}
        </>
      );

    case 'sms':
      return (
        <>
          <p className="font-medium">{message.title || '-'}</p>
          <p className="text-muted-foreground text-xs">{t('campaigns.reviewSender')}: SMS</p>
          {message.content && (
            <p className="text-muted-foreground text-xs">
              {t('campaigns.reviewContentLabel')}: {message.content}
            </p>
          )}
        </>
      );

    case 'whatsapp': {
      const parsed = parseWhatsAppBody(message.content);
      return (
        <>
          <p className="font-medium">{message.title || '-'}</p>
          <p className="text-muted-foreground text-xs">{t('campaigns.reviewSender')}: WhatsApp</p>
          {parsed && (
            <p className="text-muted-foreground text-xs">
              {t('campaigns.reviewContentLabel')}: {parsed}
            </p>
          )}
        </>
      );
    }

    case 'web-push':
      return (
        <>
          <p className="font-medium">{message.title || '-'}</p>
          {message.subject && (
            <p className="text-muted-foreground text-xs">
              {t('campaigns.reviewSubject')}: {message.subject}
            </p>
          )}
          {message.content && (
            <p className="text-muted-foreground text-xs">
              {t('campaigns.reviewContentLabel')}: {message.content}
            </p>
          )}
        </>
      );

    case 'mobile-push':
      return (
        <>
          <p className="font-medium">{message.title || '-'}</p>
          {message.subject && (
            <p className="text-muted-foreground text-xs">
              {t('campaigns.reviewSender')}: {message.subject}
            </p>
          )}
          {message.content && (
            <p className="text-muted-foreground text-xs">
              {t('campaigns.reviewContentLabel')}: {message.content}
            </p>
          )}
        </>
      );

    default:
      return (
        <>
          <p className="font-medium">{message.title || message.subject || '-'}</p>
          {(message.fromName || message.fromMail) && (
            <p className="text-muted-foreground text-xs">
              {message.fromName} {message.fromMail && `<${message.fromMail}>`}
            </p>
          )}
        </>
      );
  }
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <Badge variant="outline" className="shrink-0 font-normal">
        {label}
      </Badge>
      <span className="text-sm">{value}</span>
    </div>
  );
}

function getFrequencyText(freq: number | null | undefined, t: (key: string) => string): string {
  if (freq === RecurrenceFrequency.Daily) return t('campaigns.frequencyDailyPlural');
  if (freq === RecurrenceFrequency.Weekly) return t('campaigns.frequencyWeeklyPlural');
  if (freq === RecurrenceFrequency.Monthly) return t('campaigns.frequencyMonthlyPlural');
  return '';
}

function formatWeekDay(day: number): string {
  const labels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  return labels[day] ?? String(day);
}

function getSpreadLabel(minutes: number, t: (key: string, params?: Record<string, unknown>) => string): string {
  const opt = SPREAD_SENDING_OPTIONS.find((o) => o.value === minutes);
  if (!opt) return `${minutes}min`;
  return 'labelParams' in opt ? t(opt.labelKey, opt.labelParams as Record<string, unknown>) : t(opt.labelKey);
}

function buildTestSampleLabel(
  messages: CampaignFormValues['campaignMessage'],
  testabAudiencePercent: number,
  t: (key: string) => string,
): string {
  if (messages.length === 0) return '-';
  const perMsg = Math.round(testabAudiencePercent / messages.length);
  const parts = messages.map((_, i) => `${String.fromCharCode(65 + i)}: ${perMsg}%`);
  parts.push(`${t('campaigns.winnerMessage')}: ${100 - testabAudiencePercent}%`);
  return parts.join(' | ');
}

function parseWhatsAppBody(content: string | undefined): string {
  if (!content) return '';
  try {
    const parsed = JSON.parse(content);
    return parsed.body || '';
  } catch {
    return content;
  }
}

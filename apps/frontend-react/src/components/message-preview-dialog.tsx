/**
 * Unified message preview dialog — fetches messages by ID on-demand,
 * renders channel-specific previews (email HTML, SMS/WhatsApp chat bubbles,
 * web/mobile push notification mockups), and optionally overlays per-link
 * click statistics on email content.
 *
 * Used by: campaigns list, campaign detail, automations editor.
 */
import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ExternalLink } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { apiClient } from '@/lib/api-client';
import { useMessageClickStatistics } from '@/features/campaigns/use-message-click-statistics';
import { injectClickStatsBadges } from '@/features/campaigns/utils/inject-click-stats-badges';
import type { ClickStatEntry } from '@/features/campaigns/types';

export interface MessagePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Message IDs to fetch and preview. */
  messageIds: number[];
  /** Tab labels when showing multiple messages. Defaults to "Message A", "Message B", etc. */
  tabLabels?: string[];
  /** Show tabs for multiple messages. Defaults to true when messageIds.length > 1. */
  showTabs?: boolean;
  /** Initial tab index. */
  initialIndex?: number;
  /** When provided with filterType, fetches and shows per-link click statistics for emails. */
  filterId?: number;
  /** Scopes click statistics to campaign or automation. */
  filterType?: 'campaign' | 'automation';
}

interface MessageData {
  id: number;
  title?: string;
  subject?: string;
  previewText?: string;
  fromName?: string;
  fromMail?: string;
  content?: string;
  text?: string;
  type?: string | string[];
  url?: string;
  image?: string;
  callToActionText?: string;
}

const MESSAGE_TAB_LABELS = ['A', 'B', 'C', 'D'];

const MESSAGE_TYPE_ROUTES: Record<string, string> = {
  email: 'email',
  sms: 'sms',
  whatsapp: 'whatsapp',
  'web-push': 'web-push',
  'mobile-push': 'mobile-push',
};

function getMessageType(msg: MessageData): string {
  return Array.isArray(msg.type) ? msg.type[0] : (msg.type ?? 'email');
}

function extractLinks(html: string): string[] {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const links = new Set<string>();
    doc.querySelectorAll('a[href]').forEach((anchor) => {
      const href = anchor.getAttribute('href');
      if (href && !href.includes('[unsubscribe_link]') && href.startsWith('http')) {
        links.add(href);
      }
    });
    return Array.from(links);
  } catch {
    return [];
  }
}

function parseWhatsAppContent(content: string | undefined) {
  if (!content) return { body: '', headerType: '', headerContent: '', footer: '' };
  try {
    return JSON.parse(content);
  } catch {
    return { body: content, headerType: '', headerContent: '', footer: '' };
  }
}

export function MessagePreviewDialog({
  open,
  onOpenChange,
  messageIds,
  tabLabels,
  showTabs,
  initialIndex = 0,
  filterId,
  filterType,
}: MessagePreviewDialogProps) {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<MessageData[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [showStats, setShowStats] = useState(true);

  const messageIdsKey = messageIds.join(',');

  useEffect(() => {
    if (!open || !messageIdsKey) return;
    const ids = messageIdsKey.split(',').map(Number);
    setLoading(true);
    setCurrentIndex(initialIndex);
    Promise.all(
      ids.map((id) =>
        apiClient
          .get<MessageData>(`/messages/${id}`)
          .then((r) => r.data)
          .catch(() => null),
      ),
    ).then((results) => {
      setMessages(results.filter(Boolean) as MessageData[]);
      setLoading(false);
    });
  }, [open, messageIdsKey, initialIndex]);

  const current = messages[currentIndex];
  const currentType = current ? getMessageType(current) : 'email';
  const isEmail = currentType === 'email';
  const shouldShowTabs = showTabs ?? messageIds.length > 1;
  const labels = tabLabels ?? messageIds.map((_, i) => `Message ${MESSAGE_TAB_LABELS[i] ?? i + 1}`);

  // Click statistics (only for emails when filterId/filterType provided)
  const statsEnabled = isEmail && open && Boolean(filterId) && Boolean(filterType);
  const { data: clickStatsData } = useMessageClickStatistics(
    statsEnabled ? current?.id : undefined,
    statsEnabled ? filterId : undefined,
    statsEnabled ? filterType : undefined,
  );
  const clickStats: ClickStatEntry[] = clickStatsData?.clickStats ?? [];
  const hasStats = clickStats.length > 0;

  const handleEditMessage = () => {
    if (!current) return;
    const route = MESSAGE_TYPE_ROUTES[currentType] ?? 'email';
    window.open(`/messages/${route}/${current.id}`, '_blank');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-sm">{current?.title ?? t('campaigns.previewMessage')}</DialogTitle>
        </DialogHeader>

        {/* Tab switcher */}
        {shouldShowTabs && labels.length > 1 && (
          <div className="flex gap-2 rounded-lg border p-1" role="tablist">
            {labels.map((label, i) => (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={i === currentIndex}
                className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  i === currentIndex ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
                }`}
                onClick={() => setCurrentIndex(i)}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="space-y-3 py-4">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-[300px] w-full" />
          </div>
        ) : current ? (
          <div className="min-h-0 flex-1 overflow-y-auto" role="tabpanel">
            <PreviewContent message={current} messageType={currentType} clickStats={clickStats} showStats={showStats} />
          </div>
        ) : (
          <p className="text-muted-foreground py-8 text-center text-sm">{t('common.noResults')}</p>
        )}

        <DialogFooter className="sm:justify-between">
          {hasStats && isEmail ? (
            <div className="flex items-center gap-2">
              <Switch id="stats-toggle" checked={showStats} onCheckedChange={setShowStats} />
              <Label htmlFor="stats-toggle" className="cursor-pointer text-xs">
                {showStats ? t('campaigns.hideStatistics') : t('campaigns.showStatistics')}
              </Label>
            </div>
          ) : (
            <div />
          )}
          {current && (
            <Button variant="outline" size="sm" className="gap-2" onClick={handleEditMessage}>
              <ExternalLink className="h-3.5 w-3.5" />
              {t('campaigns.editMessage')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Channel-specific rendering ── */

interface PreviewContentProps {
  message: MessageData;
  messageType: string;
  clickStats: ClickStatEntry[];
  showStats: boolean;
}

function PreviewContent({ message, messageType, clickStats, showStats }: PreviewContentProps) {
  switch (messageType) {
    case 'email':
      return <EmailPreview message={message} clickStats={clickStats} showStats={showStats} />;
    case 'sms':
      return <SmsPreview message={message} />;
    case 'whatsapp':
      return <WhatsAppPreview message={message} />;
    case 'web-push':
      return <WebPushPreview message={message} />;
    case 'mobile-push':
      return <MobilePushPreview message={message} />;
    default:
      return <EmailPreview message={message} clickStats={clickStats} showStats={showStats} />;
  }
}

function EmailPreview({
  message,
  clickStats,
  showStats,
}: {
  message: MessageData;
  clickStats: ClickStatEntry[];
  showStats: boolean;
}) {
  const { t } = useTranslation();
  const [showAllLinks, setShowAllLinks] = useState(false);
  const links = useMemo(() => (message.content ? extractLinks(message.content) : []), [message.content]);
  const visibleLinks = showAllLinks ? links : links.slice(0, 1);

  const iframeSrcDoc = useMemo(() => {
    const html = message.content ?? '';
    if (!html || !showStats || clickStats.length === 0) return html;
    return injectClickStatsBadges(html, clickStats, (count, percent) =>
      t('campaigns.clickStatBadge', { count, percent }),
    );
  }, [message.content, clickStats, showStats, t]);

  return (
    <div className="space-y-3">
      <div className="bg-muted space-y-1 rounded-lg p-3 text-sm">
        <div className="flex gap-2">
          <span className="font-medium">{t('campaigns.previewSubject')}:</span>
          <span>{message.subject}</span>
        </div>
        {message.previewText && (
          <div className="flex gap-2 text-xs">
            <span className="font-medium">{t('campaigns.previewPreviewText')}:</span>
            <span>{message.previewText}</span>
          </div>
        )}
        {(message.fromName || message.fromMail) && (
          <div className="flex gap-2 text-xs">
            <span className="font-medium">{t('campaigns.previewFrom')}:</span>
            <span>
              {message.fromName} {message.fromMail && `<${message.fromMail}>`}
            </span>
          </div>
        )}
        {links.length > 0 && (
          <div className="space-y-0.5 text-xs">
            <span className="font-medium">{t('campaigns.previewLinks')}:</span>
            {visibleLinks.map((link, i) => (
              <a
                key={i}
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary block truncate hover:underline"
              >
                {link}
              </a>
            ))}
            {links.length > 1 && (
              <button
                type="button"
                className="text-primary text-[10px] font-semibold uppercase hover:underline"
                onClick={() => setShowAllLinks(!showAllLinks)}
              >
                {showAllLinks ? t('campaigns.previewShowLess') : t('campaigns.previewShowMore')}
              </button>
            )}
          </div>
        )}
      </div>
      {iframeSrcDoc && (
        <iframe
          srcDoc={iframeSrcDoc}
          sandbox=""
          title="Email preview"
          className="w-full rounded-lg border"
          style={{ height: 400 }}
        />
      )}
    </div>
  );
}

function SmsPreview({ message }: { message: MessageData }) {
  return (
    <div className="border-muted mx-auto max-w-sm overflow-hidden rounded-xl border-2">
      <div className="flex items-center gap-2 border-b p-3">
        <span className="text-muted-foreground text-sm">&larr;</span>
        <span className="flex-1 text-sm font-semibold">SMS</span>
      </div>
      <div className="bg-muted/30 min-h-[200px] p-4">
        <p className="text-muted-foreground mb-4 text-center text-xs">
          {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
        <div className="bg-background max-w-[75%] rounded-lg rounded-bl-none p-3 text-sm shadow-sm">
          <p>{message.content || message.text}</p>
          {message.url && (
            <a
              href={message.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary mt-1 block text-xs break-all underline"
            >
              {message.url}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function WhatsAppPreview({ message }: { message: MessageData }) {
  const parsed = parseWhatsAppContent(message.content);
  return (
    <div className="border-muted mx-auto max-w-sm overflow-hidden rounded-xl border-2">
      <div className="bg-background flex items-center gap-3 border-b p-3">
        <span className="text-muted-foreground text-sm">&larr;</span>
        <div className="bg-muted h-8 w-8 rounded-full" />
        <div className="flex-1">
          <p className="text-sm font-semibold">WhatsApp</p>
          <p className="text-muted-foreground text-xs">online</p>
        </div>
      </div>
      <div className="bg-muted/30 space-y-1 p-4">
        <div className="bg-background max-w-[80%] space-y-2 rounded-lg rounded-tl-none p-3 shadow-sm">
          {parsed.headerType === 'text' && parsed.headerContent && (
            <p className="text-sm font-semibold">{parsed.headerContent}</p>
          )}
          {parsed.headerType === 'image' && parsed.headerContent && (
            <img src={parsed.headerContent} alt="header" className="max-w-full rounded" />
          )}
          {parsed.headerType === 'video' && parsed.headerContent && (
            <video src={parsed.headerContent} controls preload="metadata" className="max-w-full rounded" />
          )}
          <p className="text-xs">{parsed.body}</p>
          {parsed.footer && <p className="text-muted-foreground text-xs">{parsed.footer}</p>}
          <div className="text-muted-foreground flex items-center justify-end gap-1 text-[10px]">
            <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </div>
        <div className="bg-background max-w-[80%] rounded-lg p-2 text-center shadow-sm">
          <span className="text-sm" style={{ color: '#35b7f1' }}>
            {message.callToActionText || 'Link'}
          </span>
        </div>
      </div>
    </div>
  );
}

function WebPushPreview({ message }: { message: MessageData }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <div>
        <p className="text-muted-foreground mb-2 text-xs font-medium">{t('campaigns.previewWeb')}</p>
        <div className="flex gap-3 rounded-lg border p-3 shadow-sm">
          {message.image && <img src={message.image} alt="" className="h-16 w-16 shrink-0 rounded object-cover" />}
          <div className="min-w-0 space-y-0.5">
            <p className="truncate text-sm font-semibold">{message.subject}</p>
            <p className="text-muted-foreground line-clamp-2 text-xs">{message.content}</p>
            {message.url && <p className="text-muted-foreground truncate text-xs">{message.url}</p>}
          </div>
        </div>
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-xs font-medium">{t('campaigns.previewAndroid')}</p>
        <div className="flex justify-between gap-3 rounded-lg border p-3 shadow-sm">
          <div className="min-w-0 space-y-0.5">
            {message.url && <p className="text-muted-foreground truncate text-[10px]">{message.url}</p>}
            <p className="truncate text-sm font-semibold">{message.subject}</p>
            <p className="text-muted-foreground line-clamp-2 text-xs">{message.content}</p>
          </div>
          {message.image && <img src={message.image} alt="" className="h-16 w-16 shrink-0 rounded object-cover" />}
        </div>
      </div>
    </div>
  );
}

function MobilePushPreview({ message }: { message: MessageData }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <div>
        <p className="text-muted-foreground mb-2 text-xs font-medium">{t('campaigns.previewAndroid')}</p>
        <div className="flex items-center justify-between gap-3 rounded-lg border p-3 shadow-sm">
          <div className="min-w-0 space-y-0.5">
            <p className="truncate text-sm font-semibold">{message.subject}</p>
            <p className="text-muted-foreground line-clamp-2 text-xs">{message.content}</p>
          </div>
          {message.image && <img src={message.image} alt="" className="h-12 w-12 shrink-0 rounded object-cover" />}
        </div>
      </div>
      <div>
        <p className="text-muted-foreground mb-2 text-xs font-medium">{t('campaigns.previewIos')}</p>
        <div className="flex items-center justify-between gap-3 rounded-lg border p-3 shadow-sm">
          <div className="min-w-0 space-y-0.5">
            <p className="truncate text-sm font-semibold">{message.subject}</p>
            <p className="text-muted-foreground line-clamp-2 text-xs">{message.content}</p>
          </div>
          {message.image && <img src={message.image} alt="" className="h-12 w-12 shrink-0 rounded object-cover" />}
        </div>
      </div>
    </div>
  );
}

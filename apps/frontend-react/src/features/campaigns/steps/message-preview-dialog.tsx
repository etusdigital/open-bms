import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ExternalLink } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import type { CampaignMessage, CampaignMessageType, ClickStatEntry } from '../types';
import { useMessageClickStatistics } from '../use-message-click-statistics';
import { injectClickStatsBadges } from '../utils/inject-click-stats-badges';

const MESSAGE_TAB_LABELS = ['A', 'B', 'C', 'D'];

interface MessagePreviewDialogProps {
  messages: CampaignMessage[];
  messageType: CampaignMessageType;
  initialIndex: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When provided along with filterType, the dialog will fetch and overlay per-link click stats. */
  filterId?: number;
  /** 'campaign' or 'automation' — scopes the statistics to a specific parent entity. */
  filterType?: 'campaign' | 'automation';
}

function extractLinks(html: string): string[] {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const links = new Set<string>();
    doc.querySelectorAll('a[href]').forEach((anchor) => {
      const href = anchor.getAttribute('href');
      if (href && !href.includes('[unsubscribe_link]')) {
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

export default function MessagePreviewDialog({
  messages,
  messageType,
  initialIndex,
  open,
  onOpenChange,
  filterId,
  filterType,
}: MessagePreviewDialogProps) {
  const { t } = useTranslation();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [showStats, setShowStats] = useState(true);
  useEffect(() => {
    if (open) setCurrentIndex(initialIndex);
  }, [open, initialIndex]);
  const validMessages = messages.filter((m) => m.id || m.messageId);
  const message = validMessages[currentIndex] ?? validMessages[0];
  const showTabs = validMessages.length > 1;

  // Fetch click statistics only when in stats mode and viewing an email
  const currentMessageId = message?.id ?? message?.messageId;
  const statsEnabled = messageType === 'email' && open;
  const { data: clickStatsData } = useMessageClickStatistics(
    statsEnabled ? currentMessageId : undefined,
    statsEnabled ? filterId : undefined,
    statsEnabled ? filterType : undefined,
  );
  const clickStats: ClickStatEntry[] = clickStatsData?.clickStats ?? [];
  const hasStats = clickStats.length > 0;

  const handleEditMessage = () => {
    if (!message) return;
    window.open(`/messages/${message.type || messageType}/${message.id}`, '_blank');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-sm">{message?.title ?? t('campaigns.previewMessage')}</DialogTitle>
        </DialogHeader>

        {/* A/B Tab switcher */}
        {showTabs && (
          <div className="flex gap-2 rounded-lg border p-1" role="tablist">
            {validMessages.map((_, idx) => (
              <button
                key={idx}
                type="button"
                role="tab"
                aria-selected={idx === currentIndex}
                className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  idx === currentIndex ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
                }`}
                onClick={() => setCurrentIndex(idx)}
              >
                {t('campaigns.messageLabel', { label: MESSAGE_TAB_LABELS[idx] ?? idx + 1 })}
              </button>
            ))}
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto" role="tabpanel">
          {message && (
            <MessagePreviewContent
              message={message}
              messageType={messageType}
              clickStats={clickStats}
              showStats={showStats}
            />
          )}
        </div>

        <DialogFooter className="sm:justify-between">
          {hasStats && messageType === 'email' ? (
            <div className="flex items-center gap-2">
              <Switch id="stats-toggle" data-testid="stats-toggle" checked={showStats} onCheckedChange={setShowStats} />
              <Label htmlFor="stats-toggle" className="cursor-pointer text-xs">
                {showStats ? t('campaigns.hideStatistics') : t('campaigns.showStatistics')}
              </Label>
            </div>
          ) : (
            <div />
          )}
          <Button type="button" variant="outline" size="sm" className="gap-2" onClick={handleEditMessage}>
            <ExternalLink className="h-3.5 w-3.5" />
            {t('campaigns.editMessage')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface MessagePreviewContentProps {
  message: CampaignMessage;
  messageType: CampaignMessageType;
  clickStats: ClickStatEntry[];
  showStats: boolean;
}

function MessagePreviewContent({ message, messageType, clickStats, showStats }: MessagePreviewContentProps) {
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
      return null;
  }
}

/* ── Email Preview ── */
function EmailPreview({
  message,
  clickStats,
  showStats,
}: {
  message: CampaignMessage;
  clickStats: ClickStatEntry[];
  showStats: boolean;
}) {
  const { t } = useTranslation();
  const [showAllLinks, setShowAllLinks] = useState(false);
  const links = useMemo(() => (message.content ? extractLinks(message.content) : []), [message.content]);
  const visibleLinks = showAllLinks ? links : links.slice(0, 1);

  // Use srcdoc iframe for safe HTML rendering (sandboxed, no script execution).
  // When click stats are available and visible, inject badge spans into the HTML
  // before passing to srcDoc — the iframe sandbox prevents post-render DOM manipulation.
  const iframeSrcDoc = useMemo(() => {
    const html = message.content ?? '';
    if (!html || !showStats || clickStats.length === 0) return html;
    return injectClickStatsBadges(html, clickStats, (count, percent) =>
      t('campaigns.clickStatBadge', { count, percent }),
    );
  }, [message.content, clickStats, showStats, t]);

  return (
    <div className="space-y-3">
      {/* Info block */}
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
        <div className="flex gap-2 text-xs">
          <span className="font-medium">{t('campaigns.previewFrom')}:</span>
          <span>
            {message.fromName} {message.fromMail && `<${message.fromMail}>`}
          </span>
        </div>
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

      {/* HTML content rendered in a sandboxed iframe for safety */}
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

/* ── SMS Preview ── */
function SmsPreview({ message }: { message: CampaignMessage }) {
  return (
    <div className="border-muted mx-auto max-w-sm overflow-hidden rounded-xl border-2">
      {/* Header bar */}
      <div className="flex items-center gap-2 border-b p-3">
        <span className="text-muted-foreground text-sm">&larr;</span>
        <span className="flex-1 text-sm font-semibold">SMS</span>
      </div>
      {/* Chat area */}
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

/* ── WhatsApp Preview ── */
function WhatsAppPreview({ message }: { message: CampaignMessage }) {
  const parsed = parseWhatsAppContent(message.content);

  return (
    <div className="border-muted mx-auto max-w-sm overflow-hidden rounded-xl border-2">
      {/* Header */}
      <div className="bg-background flex items-center gap-3 border-b p-3">
        <span className="text-muted-foreground text-sm">&larr;</span>
        <div className="bg-muted h-8 w-8 rounded-full" />
        <div className="flex-1">
          <p className="text-sm font-semibold">WhatsApp</p>
          <p className="text-muted-foreground text-xs">online</p>
        </div>
      </div>
      {/* Chat area */}
      <div className="bg-muted/30 space-y-1 p-4">
        <div className="bg-background max-w-[80%] space-y-2 rounded-lg rounded-tl-none p-3 shadow-sm">
          {/* Header content */}
          {parsed.headerType === 'text' && parsed.headerContent && (
            <p className="text-sm font-semibold">{parsed.headerContent}</p>
          )}
          {parsed.headerType === 'image' && parsed.headerContent && (
            <img src={parsed.headerContent} alt="header" className="max-w-full rounded" />
          )}
          {parsed.headerType === 'video' && parsed.headerContent && (
            <video src={parsed.headerContent} controls preload="metadata" className="max-w-full rounded" />
          )}
          {/* Body */}
          <p className="text-xs">{parsed.body}</p>
          {/* Footer */}
          {parsed.footer && <p className="text-muted-foreground text-xs">{parsed.footer}</p>}
          <div className="text-muted-foreground flex items-center justify-end gap-1 text-[10px]">
            <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </div>
        {/* CTA button */}
        <div className="bg-background max-w-[80%] rounded-lg p-2 text-center shadow-sm">
          <span className="text-sm" style={{ color: '#35b7f1' }}>
            {message.callToActionText || 'Link'}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ── Web Push Preview ── */
function WebPushPreview({ message }: { message: CampaignMessage }) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      {/* Browser notification */}
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

      {/* Android */}
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

/* ── Mobile Push Preview ── */
function MobilePushPreview({ message }: { message: CampaignMessage }) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      {/* Android */}
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

      {/* iOS */}
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

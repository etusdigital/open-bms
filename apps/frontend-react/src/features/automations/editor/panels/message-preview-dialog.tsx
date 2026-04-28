/**
 * Message preview dialog — shows email HTML content, subject, from, links.
 * Supports tabs for testAB multi-message preview.
 * "Edit Message" button opens the message editor in a new tab.
 */
import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ExternalLink } from 'lucide-react';
import DOMPurify from 'dompurify';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { apiClient } from '@/lib/api-client';

interface MessagePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  messageIds: number[];
  tabLabels?: string[];
  showTabs?: boolean;
  initialIndex?: number;
}

interface MessageData {
  id: number;
  title: string;
  subject?: string;
  previewText?: string;
  fromName?: string;
  fromMail?: string;
  content?: string;
  text?: string;
  type?: string | string[];
  url?: string;
  image?: string;
}

function isPushType(type?: string | string[]): boolean {
  const t = Array.isArray(type) ? type[0] : type;
  return t === 'web-push' || t === 'mobile-push';
}

function extractDomain(url?: string): string {
  if (!url) return '';
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

const MESSAGE_TYPE_ROUTES: Record<string, string> = {
  email: 'email',
  sms: 'sms',
  whatsapp: 'whatsapp',
  'web-push': 'web-push',
  'mobile-push': 'mobile-push',
};

function extractLinks(html: string): string[] {
  if (!html) return [];
  const matches = html.match(/href="([^"]+)"/g) ?? [];
  return matches
    .map((m) => m.replace('href="', '').replace('"', ''))
    .filter((url) => !url.includes('unsubscribe_link') && url.startsWith('http'));
}

function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    ADD_TAGS: ['style'],
    ADD_ATTR: ['target', 'style'],
  });
}

export function MessagePreviewDialog({
  open,
  onOpenChange,
  messageIds,
  tabLabels,
  showTabs = false,
  initialIndex = 0,
}: MessagePreviewDialogProps) {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<MessageData[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

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
  const links = current?.content ? extractLinks(current.content) : [];

  const handleEditMessage = () => {
    if (!current) return;
    const type = Array.isArray(current.type) ? current.type[0] : current.type;
    const route = MESSAGE_TYPE_ROUTES[type ?? 'email'] ?? 'email';
    window.open(`/messages/${route}/${current.id}`, '_blank');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{current?.title ?? t('automations.editor.preview.title')}</DialogTitle>
        </DialogHeader>

        {showTabs && tabLabels && tabLabels.length > 1 && (
          <div className="flex gap-1 border-b pb-2">
            {tabLabels.map((label, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setCurrentIndex(i)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  currentIndex === i ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'
                }`}
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
          <div className="flex-1 space-y-3 overflow-y-auto">
            <div className="bg-muted/50 space-y-1 rounded-md p-3 text-xs">
              {isPushType(current.type) ? (
                /* Push: show link */
                current.url && (
                  <p>
                    <strong>Link:</strong>{' '}
                    <a
                      href={current.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary break-all underline"
                    >
                      {current.url}
                    </a>
                  </p>
                )
              ) : (
                /* Email/SMS/WhatsApp: show subject, from, links */
                <>
                  {current.subject && (
                    <p>
                      <strong>{t('automations.editor.preview.subject')}:</strong> {current.subject}
                    </p>
                  )}
                  {current.previewText && (
                    <p>
                      <strong>{t('automations.editor.preview.previewText')}:</strong> {current.previewText}
                    </p>
                  )}
                  {(current.fromName || current.fromMail) && (
                    <p>
                      <strong>{t('automations.editor.preview.from')}:</strong> {current.fromName}{' '}
                      {current.fromMail ? `<${current.fromMail}>` : ''}
                    </p>
                  )}
                  {links.length > 0 && (
                    <p>
                      <strong>{t('automations.editor.preview.links')}:</strong>{' '}
                      {links.map((url, i) => (
                        <span key={i}>
                          {i > 0 && ', '}
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary break-all underline"
                          >
                            {url.length > 60 ? `${url.slice(0, 60)}...` : url}
                          </a>
                        </span>
                      ))}
                    </p>
                  )}
                </>
              )}
            </div>

            {/* Email: render HTML in iframe */}
            {current.content && !isPushType(current.type) && <EmailPreviewFrame html={sanitizeHtml(current.content)} />}

            {/* Web/Mobile Push: notification-style preview */}
            {isPushType(current.type) && (
              <PushPreview
                title={current.subject ?? current.title}
                body={current.text ?? current.content ?? ''}
                image={current.image}
                url={current.url}
              />
            )}

            {/* SMS/WhatsApp or fallback URL */}
            {!current.content && !isPushType(current.type) && current.url && (
              <div className="bg-muted/30 rounded-md border p-3 text-sm">
                <p>
                  <strong>URL:</strong>{' '}
                  <a href={current.url} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                    {current.url}
                  </a>
                </p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-muted-foreground py-8 text-center text-sm">{t('automations.editor.preview.notFound')}</p>
        )}

        {current && (
          <div className="flex justify-end border-t pt-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handleEditMessage}>
              <ExternalLink className="h-3.5 w-3.5" />
              {t('automations.editor.preview.editMessage')}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Renders email HTML inside a sandboxed iframe to isolate it from
 * the app's dark mode styles. Auto-resizes height to fit content.
 */
/**
 * Push notification preview showing Web and Android styles.
 */
function PushPreview({ title, body, image, url }: { title?: string; body?: string; image?: string; url?: string }) {
  const domain = extractDomain(url);

  return (
    <div className="space-y-4">
      {/* Web preview */}
      <div>
        <p className="mb-1.5 text-sm font-semibold">Web</p>
        <div className="flex items-start gap-3 rounded-lg border bg-white p-4">
          {image && <img src={image} alt="" className="h-12 w-12 shrink-0 rounded object-contain" />}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-900">{title}</p>
            <p className="mt-0.5 text-sm text-gray-600">{body}</p>
            {domain && <p className="mt-1 text-xs text-gray-400">{domain}</p>}
          </div>
        </div>
      </div>

      {/* Android preview */}
      <div>
        <p className="mb-1.5 text-sm font-semibold">Android</p>
        <div className="flex items-start gap-3 rounded-lg border bg-white p-4">
          <div className="min-w-0 flex-1">
            {domain && <p className="text-xs text-gray-400">{domain}</p>}
            <p className="text-sm font-semibold text-gray-900">{title}</p>
            <p className="mt-0.5 text-sm text-gray-600">{body}</p>
          </div>
          {image && <img src={image} alt="" className="h-14 w-14 shrink-0 rounded object-contain" />}
        </div>
      </div>
    </div>
  );
}

function EmailPreviewFrame({ html }: { html: string }) {
  const srcdoc = useMemo(
    () => `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { margin: 0; padding: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; color: #000; background: #fff; }
    img { max-width: 100%; height: auto; }
    a { color: #1a73e8; }
  </style>
</head>
<body>${html}</body>
</html>`,
    [html],
  );

  return (
    <iframe
      srcDoc={srcdoc}
      className="max-h-[400px] w-full rounded-md border bg-white"
      sandbox=""
      title="Email preview"
      style={{ minHeight: 200 }}
    />
  );
}

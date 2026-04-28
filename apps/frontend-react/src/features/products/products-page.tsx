import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { ListPage } from '@/components/list-page';
import { Skeleton } from '@/components/ui/skeleton';
import { useAppStore } from '@/stores/app-store';
import { useProducts } from './use-products';
import { formatDate, getWeekDays, isToday, flattenProducts, getUniqueHours } from './products-utils';
import type { ProductItem, ProductMessage } from './types';

export function MessageStats({ stats }: { stats: NonNullable<ProductMessage['campaign_message_statistics']> }) {
  const { t } = useTranslation();

  const items = [
    { label: t('products.delivered'), value: stats.delivered },
    { label: t('products.opens'), value: stats.open },
    { label: t('products.clicks'), value: stats.click },
    { label: t('products.bounces'), value: stats.bounce },
    { label: t('products.unsubscribes'), value: stats.unsubscribe },
  ];

  return (
    <div className="border-border mt-1.5 border-t pt-1.5">
      <p className="text-muted-foreground mb-1 text-[10px] font-semibold uppercase">{t('products.statistics')}</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11px]">
        {items.map((item) => (
          <div key={item.label} className="flex justify-between">
            <span className="text-muted-foreground">{item.label}</span>
            <span className="font-medium">{item.value.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MessageChip({ msg }: { msg: ProductMessage }) {
  const { t } = useTranslation();

  return (
    <div className="bg-accent rounded-md p-2 text-center text-xs">
      <p className="font-medium">
        {msg.campaign_message_winner && <span className="animate-trophy mr-1 inline-block">🏆</span>}
        {msg.message_name}
      </p>
      <div className="mt-1 space-y-0.5 text-[11px]">
        <p>
          <span className="text-muted-foreground font-semibold uppercase">{t('products.messageName')}: </span>
          {msg.message_name}
        </p>
        <p className="line-clamp-2">
          <span className="text-muted-foreground font-semibold uppercase">{t('products.messageSubject')}: </span>
          {msg.message_subject}
        </p>
        <p>
          <span className="text-muted-foreground font-semibold uppercase">{t('products.messageSender')}: </span>
          {msg.message_sender}
        </p>
        <p>
          <span className="text-muted-foreground font-semibold uppercase">{t('products.messageSenderName')}: </span>
          {msg.message_sender_name}
        </p>
      </div>
      {msg.campaign_message_statistics && <MessageStats stats={msg.campaign_message_statistics} />}
    </div>
  );
}

export function ProductTags({ product }: { product: ProductItem }) {
  const { t } = useTranslation();
  const tagNames = Object.values(product.tags).map((tag: any) =>
    typeof tag === 'object' && tag !== null && 'name' in tag ? tag.name : String(tag),
  );

  if (!product.sendToAll && tagNames.length === 0) return null;

  const maxTags = 6;
  const visibleTags = tagNames.slice(0, maxTags);
  const remainingTags = tagNames.length - maxTags;

  return (
    <div>
      <p className="text-muted-foreground mb-1.5 border-b pb-1 text-[10px] font-semibold uppercase">
        {t('products.tags')}
      </p>
      <div className="flex flex-wrap gap-1">
        {product.sendToAll ? (
          <Badge variant="secondary" className="text-[10px]">
            {t('products.sendToAll')}
          </Badge>
        ) : (
          <>
            {visibleTags.map((tag) => (
              <Badge
                key={tag}
                variant="outline"
                className="border-amber-200 bg-amber-50 text-[10px] text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
              >
                {tag}
              </Badge>
            ))}
            {remainingTags > 0 && (
              <span className="text-muted-foreground text-[10px]">
                +{remainingTags} {t('products.more')}
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export function ProductHoverContent({ product }: { product: ProductItem }) {
  const { t } = useTranslation();
  const messages = product.messages.slice(0, 4);
  const remaining = product.messages.length - 4;

  return (
    <div className="w-80 space-y-3 text-xs">
      {/* Messages section */}
      <div>
        <p className="text-muted-foreground mb-1.5 border-b pb-1 text-[10px] font-semibold uppercase">
          {t('products.messages')}
        </p>
        <div className="space-y-2">
          {messages.map((msg, i) => (
            <MessageChip key={i} msg={msg} />
          ))}
        </div>
        {remaining > 0 && (
          <p className="text-muted-foreground mt-1.5 text-[11px]">
            +{remaining} {t('products.more')}
          </p>
        )}
      </div>

      {/* Tags section */}
      <ProductTags product={product} />
    </div>
  );
}

export function ProductLinks({ link }: { link: string | string[] }) {
  const links = Array.isArray(link) ? link : link ? [link] : [];
  if (links.length === 0) return null;

  return (
    <div className="mt-1 space-y-0.5">
      {links.map((url, i) => (
        <div key={i} className="bg-muted text-muted-foreground truncate rounded px-1 py-0.5 text-[10px]" title={url}>
          {url}
        </div>
      ))}
    </div>
  );
}

function ProductCard({ product }: { product: ProductItem }) {
  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>
        <div className="min-h-[48px] cursor-default overflow-hidden rounded-lg border p-2 text-xs">
          <p className="text-primary truncate font-medium">{product.title}</p>
          <ProductLinks link={product.link} />
        </div>
      </HoverCardTrigger>
      <HoverCardContent side="right" align="start" className="w-auto p-3">
        <ProductHoverContent product={product} />
      </HoverCardContent>
    </HoverCard>
  );
}

export default function ProductsPage() {
  const { t } = useTranslation();
  const [weekOffset, setWeekOffset] = useState(0);

  const auth = useAppStore((s) => s.auth);
  const timezone = auth.status === 'authenticated' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC';

  const startDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + weekOffset * 7);
    return d;
  }, [weekOffset]);

  const weekDays = useMemo(() => getWeekDays(startDate), [startDate]);
  const dateParam = formatDate(weekDays[0]);

  const query = useProducts(dateParam, timezone);

  const flatMap = useMemo(() => (query.data?.products ? flattenProducts(query.data.products) : {}), [query.data]);

  const hours = useMemo(() => getUniqueHours(flatMap), [flatMap]);

  const dayFormatter = new Intl.DateTimeFormat(undefined, { weekday: 'short' });
  const dateFormatter = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' });

  return (
    <ListPage.Root>
      <ListPage.Header title={t('products.pageTitle')}>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon-xs" onClick={() => setWeekOffset((w) => w - 1)}>
            <ChevronLeft className="h-4 w-4" />
            <span className="sr-only">{t('products.previousWeek')}</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => setWeekOffset(0)}>
            {t('products.today')}
          </Button>
          <Button variant="outline" size="icon-xs" onClick={() => setWeekOffset((w) => w + 1)}>
            <ChevronRight className="h-4 w-4" />
            <span className="sr-only">{t('products.nextWeek')}</span>
          </Button>
        </div>
      </ListPage.Header>

      <ListPage.Content>
        {query.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : hours.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Package className="text-muted-foreground/50 mb-3 h-10 w-10" />
            <p className="text-muted-foreground text-sm">{t('products.noProducts')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full table-fixed border-collapse text-sm">
              <thead>
                <tr>
                  <th className="bg-muted/60 text-muted-foreground w-16 border-b px-2 py-2 text-left text-xs font-medium">
                    {t('products.hour')}
                  </th>
                  {weekDays.map((day) => {
                    const dateStr = formatDate(day);
                    const dayProducts = flatMap[dateStr];
                    const count = dayProducts
                      ? Object.values(dayProducts).reduce((sum, slot) => sum + slot.products.length, 0)
                      : 0;

                    return (
                      <th
                        key={dateStr}
                        className={`bg-muted/60 border-b px-2 py-2 text-center text-xs font-medium ${
                          isToday(day) ? 'border-b-primary text-primary border-b-2' : 'text-muted-foreground'
                        }`}
                      >
                        <div>{dayFormatter.format(day)}</div>
                        <div>{dateFormatter.format(day)}</div>
                        {count > 0 && (
                          <Badge variant="secondary" className="mt-0.5 text-[10px]">
                            {count}
                          </Badge>
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {hours.map((hour) => (
                  <tr key={hour} className="border-b">
                    <td className="bg-muted/40 text-muted-foreground px-2 py-1 align-top text-xs">{hour}</td>
                    {weekDays.map((day) => {
                      const dateStr = formatDate(day);
                      const slot = flatMap[dateStr]?.[hour];
                      const products = slot?.products ?? [];

                      return (
                        <td
                          key={dateStr}
                          className={`overflow-hidden px-1 py-1 align-top ${isToday(day) ? 'bg-primary/5' : ''}`}
                        >
                          {products.length === 0 ? (
                            <p className="text-muted-foreground/50 py-2 text-center text-[10px]">
                              {t('products.noProductInSlot')}
                            </p>
                          ) : (
                            <div className="space-y-1">
                              {products.map((product, i) => (
                                <ProductCard key={i} product={product} />
                              ))}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ListPage.Content>
    </ListPage.Root>
  );
}

import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useBulkAddTags, useBulkRemoveTags, useTagOptions } from '../use-contact-tags';
import type { ContactTag } from '../types';

interface ContactTagsCardProps {
  contactId: number;
  tags: ContactTag[];
}

export const ContactTagsCard = memo(function ContactTagsCard({ contactId, tags }: ContactTagsCardProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState(false);

  const tagsQuery = useTagOptions(enabled);
  const addTag = useBulkAddTags();
  const removeTag = useBulkRemoveTags();

  const handleOpen = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen && !enabled) setEnabled(true);
  };

  const handleAdd = (tagId: number) => {
    addTag.mutate({ contactIds: [contactId], tagIds: [tagId] });
    setOpen(false);
  };

  const handleRemove = (tagId: number) => {
    removeTag.mutate({ contactIds: [contactId], tagIds: [tagId] });
  };

  const currentTagIds = new Set(tags.map((t) => t.id));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base">{t('contacts.tagsColumn', 'Tags')}</CardTitle>
        <Popover open={open} onOpenChange={handleOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm">
              <Plus className="mr-1 h-3.5 w-3.5" />
              {t('contacts.addTag')}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[220px] p-0" align="end">
            <Command>
              <CommandInput placeholder={t('common.search', 'Buscar...')} className="h-8 text-xs" />
              <CommandList>
                {tagsQuery.isLoading ? (
                  <div className="space-y-1.5 p-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <Skeleton key={i} className="h-6 w-full rounded" />
                    ))}
                  </div>
                ) : (
                  <>
                    <CommandEmpty className="text-muted-foreground py-4 text-center text-xs">
                      {t('common.noResults', 'Nenhum resultado')}
                    </CommandEmpty>
                    <CommandGroup>
                      {(tagsQuery.data ?? []).map((option) => {
                        const id = Number(option.value);
                        const alreadyAdded = currentTagIds.has(id);
                        return (
                          <CommandItem
                            key={option.value}
                            value={option.label}
                            onSelect={() => !alreadyAdded && handleAdd(id)}
                            className="text-xs"
                            disabled={alreadyAdded}
                          >
                            <Check className={cn('mr-2 h-3 w-3', alreadyAdded ? 'opacity-100' : 'opacity-0')} />
                            {option.label}
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </CardHeader>
      <CardContent>
        {tags.length === 0 ? (
          <p className="text-muted-foreground text-sm">—</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <Badge key={tag.id} variant="secondary" className="gap-1 text-xs">
                {tag.name || tag.title}
                <button
                  type="button"
                  onClick={() => handleRemove(tag.id)}
                  className="hover:bg-muted ml-0.5 rounded-full"
                  disabled={removeTag.isPending}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
});

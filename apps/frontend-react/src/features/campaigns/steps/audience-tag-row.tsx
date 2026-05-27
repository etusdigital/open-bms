import { useState, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, ChevronsUpDown, X, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { useDebounce } from '@/hooks/use-debounce';
import { useTagsForAudience, type TagOptionFull } from '../use-campaign-tags';
import type { AudienceStepItem } from '../types';

interface AudienceTagRowProps {
  step: AudienceStepItem;
  onUpdate: (updates: Partial<AudienceStepItem>) => void;
  onRemove: () => void;
  canRemove: boolean;
}

export default function AudienceTagRow({ step, onUpdate, onRemove, canRemove }: AudienceTagRowProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [tagSearch, setTagSearch] = useState('');
  const debouncedTagSearch = useDebounce(tagSearch, 300);
  const { data: tagOptions = [], isLoading } = useTagsForAudience(debouncedTagSearch);

  const selectedTagIds = step.tag_id ?? [];
  const tagInfo = step.tag_info ?? [];

  // Cache id→label so selected tags show names even when not in search results
  const labelCacheRef = useRef(new Map<number, TagOptionFull>());
  for (const opt of tagOptions) {
    labelCacheRef.current.set(opt.id, opt);
  }

  const selectedTags = useMemo(
    () =>
      tagInfo.length > 0
        ? tagInfo
        : (selectedTagIds
            .map((id) => {
              const cached = labelCacheRef.current.get(id);
              return cached ? { id: cached.id, name: cached.name, count: cached.count, type: cached.type } : null;
            })
            .filter(Boolean) as NonNullable<AudienceStepItem['tag_info']>),
    [selectedTagIds, tagInfo, tagOptions], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const handleToggleTag = (option: TagOptionFull) => {
    const tagId = option.id;
    if (selectedTagIds.includes(tagId)) {
      // Remove
      onUpdate({
        tag_id: selectedTagIds.filter((id) => id !== tagId),
        tag_info: tagInfo.filter((t) => t.id !== tagId),
      });
    } else {
      // Add
      onUpdate({
        tag_id: [...selectedTagIds, tagId],
        tag_info: [...tagInfo, { id: option.id, name: option.name, count: option.count, type: option.type }],
      });
    }
  };

  const handleRemoveTag = (tagId: number) => {
    onUpdate({
      tag_id: selectedTagIds.filter((id) => id !== tagId),
      tag_info: tagInfo.filter((t) => t.id !== tagId),
    });
  };

  return (
    <div className="flex items-start gap-2" data-testid="audience-tag-row">
      {/* conditional_tag: Tem / Não tem */}
      <Select
        value={step.conditional_tag ?? 'in'}
        onValueChange={(value) => onUpdate({ conditional_tag: value as 'in' | 'not in' })}
      >
        <SelectTrigger className="h-9 w-[130px] shrink-0 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="in" className="text-xs">
            {t('campaigns.audienceHas')}
          </SelectItem>
          <SelectItem value="not in" className="text-xs">
            {t('campaigns.audienceHasNot')}
          </SelectItem>
        </SelectContent>
      </Select>

      {/* Tag multi-select */}
      <div className="min-w-0 flex-1">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="h-auto min-h-[2.25rem] w-full justify-between py-1 font-normal"
            >
              <div className="flex flex-wrap items-center gap-1 overflow-hidden">
                {selectedTags.length > 0 ? (
                  selectedTags.map((tag) => (
                    <Badge
                      key={tag.id}
                      className="bg-primary/15 text-primary border-primary/20 hover:bg-primary/20 shrink-0 gap-0.5 px-1.5 py-0 text-[11px]"
                    >
                      {tag.name}
                      <span
                        role="button"
                        tabIndex={0}
                        className="hover:bg-secondary-foreground/20 ml-0.5 cursor-pointer rounded-full"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveTag(tag.id);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.stopPropagation();
                            handleRemoveTag(tag.id);
                          }
                        }}
                      >
                        <X className="h-2.5 w-2.5" />
                      </span>
                    </Badge>
                  ))
                ) : (
                  <span className="text-muted-foreground text-xs">{t('campaigns.audienceSelectTags')}</span>
                )}
              </div>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
            <Command shouldFilter={false}>
              <CommandInput
                placeholder={t('common.search', 'Buscar...')}
                value={tagSearch}
                onValueChange={setTagSearch}
              />
              <CommandList>
                <CommandEmpty>
                  {isLoading ? t('common.loading') : t('common.noResults', 'Nenhum resultado.')}
                </CommandEmpty>
                <CommandGroup>
                  {tagOptions.map((option) => {
                    const isSelected = selectedTagIds.includes(option.id);
                    return (
                      <CommandItem key={option.value} value={option.value} onSelect={() => handleToggleTag(option)}>
                        <Check className={cn('mr-2 h-4 w-4', isSelected ? 'opacity-100' : 'opacity-0')} />
                        {option.label}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {/* Remove row button */}
      {canRemove && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-destructive hover:text-destructive h-9 w-9 shrink-0"
          onClick={onRemove}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Skeleton } from '@/components/ui/skeleton';
import { apiClient } from '@/lib/api-client';
import { useAppStore } from '@/stores/app-store';
import { cn } from '@/lib/utils';
import { useBuilderActions, useBuilderMeta } from './builder-context';
import { TAG_CONDITIONALS } from './constants';
import { StepField } from './interaction-step';
import type { TagStepData } from './types';

interface TagOption {
  id: number;
  name: string;
  type?: string;
  lastCount?: number;
}

function useBuilderTags() {
  const auth = useAppStore((s) => s.auth);
  const accountId = auth.status === 'authenticated' ? auth.account.id : 0;

  return useQuery({
    queryKey: ['builder-tags', accountId],
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.get<{ results: TagOption[] }>('/tags', {
        params: { type: 'tag', itemsPerPage: 200 },
        signal,
      });
      return data.results ?? [];
    },
    enabled: auth.status === 'authenticated',
    staleTime: 2 * 60_000,
  });
}

interface TagStepProps {
  data: TagStepData;
  cardId: string;
}

export const TagStep = memo(function TagStep({ data, cardId }: TagStepProps) {
  const { t } = useTranslation();
  const actions = useBuilderActions();
  const meta = useBuilderMeta();
  const { data: availableTags = [], isLoading } = useBuilderTags();
  const [open, setOpen] = useState(false);

  const selectedIds = new Set(data.tag_id ?? []);
  const selectedTags = data.tag_info ?? [];

  const update = (field: Partial<Omit<TagStepData, 'type' | 'id' | 'stepConnector'>>) => {
    actions.updateStep(cardId, data.id, 'tag', field);
  };

  const toggleTag = (tag: TagOption) => {
    if (selectedIds.has(tag.id)) {
      // Remove
      update({
        tag_id: [...selectedIds].filter((id) => id !== tag.id),
        tag_info: selectedTags.filter((t) => t.id !== tag.id),
      });
    } else {
      // Add
      // The backend schema (obj_conditional_tag.tag_info) requires `type` and accepts
      // `count`. The /tags API returns `lastCount` and may omit `type`; we translate
      // here at the source. `segment-base-size` is not a valid schema value, so we
      // fall back to 'tag' for anything outside the {tag, segment} pair.
      const normalizedType: 'tag' | 'segment' = tag.type === 'segment' ? 'segment' : 'tag';
      update({
        tag_id: [...selectedIds, tag.id],
        tag_info: [...selectedTags, { id: tag.id, name: tag.name, type: normalizedType, count: tag.lastCount ?? null }],
      });
    }
  };

  const removeTag = (tagId: number) => {
    update({
      tag_id: [...selectedIds].filter((id) => id !== tagId),
      tag_info: selectedTags.filter((t) => t.id !== tagId),
    });
  };

  return (
    <div className="bg-secondary/30 rounded-lg p-3">
      <div className="flex flex-wrap gap-x-4 gap-y-3">
        {/* Conditional: has / doesn't have */}
        <StepField label={t('segments.builder.conditional')}>
          <Select
            value={data.conditional_tag ?? 'in'}
            onValueChange={(value) => update({ conditional_tag: value as 'in' | 'not in' })}
            disabled={meta.isDisabled}
          >
            <SelectTrigger size="sm" className="w-[160px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TAG_CONDITIONALS.map((tc) => (
                <SelectItem key={tc.value} value={tc.value} className="text-xs">
                  {t(tc.labelKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </StepField>

        {/* Tag multi-select */}
        <StepField label="Tags">
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                role="combobox"
                className="h-auto min-h-[2rem] min-w-[250px] justify-between px-2 py-1 text-xs font-normal"
                disabled={meta.isDisabled}
              >
                <div className="flex flex-wrap items-center gap-0.5">
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
                            removeTag(tag.id);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.stopPropagation();
                              removeTag(tag.id);
                            }
                          }}
                        >
                          <X className="h-2.5 w-2.5" />
                        </span>
                      </Badge>
                    ))
                  ) : (
                    <span className="text-muted-foreground">{t('common.select', 'Selecionar')}...</span>
                  )}
                </div>
                <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[250px] p-0" align="start">
              <Command>
                <CommandInput placeholder={t('common.search', 'Buscar...')} className="h-8 text-xs" />
                <CommandList>
                  {isLoading ? (
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
                        {availableTags.map((tag) => (
                          <CommandItem key={tag.id} onSelect={() => toggleTag(tag)} className="text-xs">
                            <Check
                              className={cn('mr-2 h-3 w-3', selectedIds.has(tag.id) ? 'opacity-100' : 'opacity-0')}
                            />
                            <span>{tag.name}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </>
                  )}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </StepField>
      </div>
    </div>
  );
});

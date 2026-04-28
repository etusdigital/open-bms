import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { UnsavedChangesDialog } from '@/components/unsaved-changes-dialog';
import { useConfigsForSelect } from './use-campaign-configs';
import {
  campaignRuleFormSchema,
  RULE_NAME_MAX,
  RULE_DESCRIPTION_MAX,
  type CampaignRuleFormValues,
} from './campaign-rule-schema';

const WEEK_DAYS = [
  { value: 1, labelKey: 'campaignRules.monday' },
  { value: 2, labelKey: 'campaignRules.tuesday' },
  { value: 3, labelKey: 'campaignRules.wednesday' },
  { value: 4, labelKey: 'campaignRules.thursday' },
  { value: 5, labelKey: 'campaignRules.friday' },
  { value: 6, labelKey: 'campaignRules.saturday' },
  { value: 0, labelKey: 'campaignRules.sunday' },
];

interface CampaignRuleFormProps {
  defaultValues?: CampaignRuleFormValues;
  onSubmit: (data: CampaignRuleFormValues) => void;
  isPending: boolean;
}

export function CampaignRuleForm({ defaultValues, onSubmit, isPending }: CampaignRuleFormProps) {
  const { t } = useTranslation();
  const isEditing = defaultValues !== undefined;

  const form = useForm<CampaignRuleFormValues>({
    resolver: zodResolver(campaignRuleFormSchema) as never,
    defaultValues: defaultValues ?? {
      name: '',
      description: '',
      weekDays: [],
      configs: [],
    },
  });

  const nameLength = form.watch('name')?.length ?? 0;
  const descriptionLength = form.watch('description')?.length ?? 0;

  return (
    <>
      <UnsavedChangesDialog isDirty={form.formState.isDirty} isPending={isPending} />
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between">
                  <FormLabel>{t('campaignRules.name')}</FormLabel>
                  <span className="text-muted-foreground text-xs">
                    {t('validation.charCount', { count: nameLength, max: RULE_NAME_MAX })}
                  </span>
                </div>
                <FormControl>
                  <Input {...field} maxLength={RULE_NAME_MAX} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between">
                  <FormLabel>{t('campaignRules.description')}</FormLabel>
                  <span className="text-muted-foreground text-xs">
                    {t('validation.charCount', {
                      count: descriptionLength,
                      max: RULE_DESCRIPTION_MAX,
                    })}
                  </span>
                </div>
                <FormControl>
                  <Textarea rows={3} {...field} maxLength={RULE_DESCRIPTION_MAX} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="weekDays"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('campaignRules.weekDays')}</FormLabel>
                <div className="flex gap-2">
                  {WEEK_DAYS.map((day) => {
                    const isSelected = field.value?.includes(day.value);
                    return (
                      <Button
                        key={day.value}
                        type="button"
                        size="sm"
                        variant={isSelected ? 'default' : 'outline'}
                        className="h-10 w-10"
                        onClick={() => {
                          const current = field.value ?? [];
                          field.onChange(isSelected ? current.filter((d) => d !== day.value) : [...current, day.value]);
                        }}
                      >
                        {t(day.labelKey as never)}
                      </Button>
                    );
                  })}
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          <ConfigMultiSelect form={form} />

          {form.formState.errors.root?.serverError && (
            <div role="alert" className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
              {form.formState.errors.root.serverError.message}
            </div>
          )}

          <Button type="submit" disabled={isPending}>
            {isPending ? t('common.loading') : isEditing ? t('common.save') : t('common.create')}
          </Button>
        </form>
      </Form>
    </>
  );
}

/* ── Config Multi-Select ───────────────────────────────────────────── */

function ConfigMultiSelect({ form }: { form: ReturnType<typeof useForm<CampaignRuleFormValues>> }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { data: configOptions = [] } = useConfigsForSelect();
  const selected = form.watch('configs') ?? [];

  const handleToggle = (value: string, label: string) => {
    const id = Number(value);
    const current = selected ?? [];
    const exists = current.some((c) => c.id === id);
    form.setValue('configs', exists ? current.filter((c) => c.id !== id) : [...current, { id, name: label }]);
  };

  const handleRemove = (id: number) => {
    form.setValue(
      'configs',
      (selected ?? []).filter((c) => c.id !== id),
    );
  };

  return (
    <FormItem>
      <FormLabel>{t('campaignRules.configs', 'Configurações')}</FormLabel>

      {/* Selected chips */}
      {selected.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {selected.map((cfg) => (
            <Badge key={cfg.id} variant="secondary" className="gap-1 pr-1">
              {cfg.name}
              <button
                type="button"
                className="hover:bg-muted rounded-full p-0.5"
                onClick={() => handleRemove(cfg.id)}
                data-testid={`config-remove-${cfg.id}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal"
            data-testid="config-select"
          >
            {t('campaignRules.selectConfigs', 'Selecionar configurações...')}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command>
            <CommandInput placeholder={t('common.search', 'Buscar...')} />
            <CommandList>
              <CommandEmpty>{t('common.noResults', 'Nenhum resultado.')}</CommandEmpty>
              <CommandGroup>
                {configOptions.map((option) => {
                  const isSelected = selected.some((c) => c.id === Number(option.value));
                  return (
                    <CommandItem
                      key={option.value}
                      value={option.label}
                      onSelect={() => handleToggle(option.value, option.label)}
                    >
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
    </FormItem>
  );
}

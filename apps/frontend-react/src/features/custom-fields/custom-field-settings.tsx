import { useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { GripVertical, Plus, Trash2, ChevronUp, ChevronDown, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  CUSTOM_FIELD_LABEL_MAX,
  CUSTOM_FIELD_PLACEHOLDER_MAX,
  CUSTOM_FIELD_MASK_MAX,
  NUMBER_FORMATS,
  DATE_FORMATS,
  LIST_SELECTION_TYPES,
  LIST_RENDER_TYPES,
  FILE_FORMATS,
  ATTRIBUTION_TYPES,
  type CustomFieldType,
  type CustomFieldFormValues,
} from './custom-field-schema';

const MASK_HELP_URL =
  'https://etusmedia.atlassian.net/wiki/spaces/BHC/pages/1802862615/O+que+s+o+m+scaras+e+como+criar';

interface CustomFieldSettingsProps {
  type: CustomFieldType;
  /** Some settings (attribution type) are locked when editing an existing field. */
  isEditing: boolean;
}

export function CustomFieldSettings({ type, isEditing }: CustomFieldSettingsProps) {
  const { t } = useTranslation();
  const form = useFormContext<CustomFieldFormValues>();

  const renderType = form.watch('fieldType');
  const placeholderDisabled = type === 'list' && renderType !== 'dropdown';

  // Format/selection select: number → integer/decimal, date → format, list → single/multiple.
  const formatConfig: Record<string, { label: string; placeholder: string; options: readonly string[] } | undefined> = {
    number: {
      label: t('customFields.numberFormat'),
      placeholder: t('customFields.selectNumberFormat'),
      options: NUMBER_FORMATS,
    },
    date: {
      label: t('customFields.dateFormat'),
      placeholder: t('customFields.selectDateFormat'),
      options: DATE_FORMATS,
    },
    list: {
      label: t('customFields.selectionType'),
      placeholder: t('customFields.selectSelectionType'),
      options: LIST_SELECTION_TYPES,
    },
  };
  const format = formatConfig[type];

  // One column per inline input: all on one line when the viewport is wide enough,
  // collapsing to fewer columns on smaller screens. Full-width rows use col-span-full.
  const colsClass: Record<CustomFieldType, string> = {
    text: 'lg:grid-cols-4', // label, placeholder, mask, character limit
    number: 'lg:grid-cols-5', // format, label, placeholder, mask, decimal length
    date: 'lg:grid-cols-3 gap-y-4', // format, label, placeholder
    list: 'lg:grid-cols-4 gap-y-4', // selection type, render type, label, placeholder
    file: 'lg:grid-cols-3 gap-y-4', // file formats, label, placeholder
  };

  return (
    <div className={cn('grid grid-cols-1 items-start gap-x-4 sm:grid-cols-2', colsClass[type])}>
      {/* Format / selection-type select (number, date, list) */}
      {format && (
        <FormField
          control={form.control}
          name="fieldFormat"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{format.label}</FormLabel>
              <Select onValueChange={field.onChange} value={field.value ?? ''}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={format.placeholder} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {format.options.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {t(`customFields.format_${opt}` as never)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      {/* List render type */}
      {type === 'list' && (
        <FormField
          control={form.control}
          name="fieldType"
          render={({ field }) => {
            const selection = form.watch('fieldFormat');
            // dropdown always; radio for single, checkbox for multiple.
            const allowed = LIST_RENDER_TYPES.filter(
              (rt) =>
                rt === 'dropdown' ||
                (rt === 'radio' && selection === 'single') ||
                (rt === 'checkbox' && selection === 'multiple'),
            );
            return (
              <FormItem>
                <FormLabel>{t('customFields.renderType')}</FormLabel>
                <Select onValueChange={field.onChange} value={field.value ?? ''} disabled={!selection}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={t('customFields.selectRenderType')} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {allowed.map((rt) => (
                      <SelectItem key={rt} value={rt}>
                        {t(`customFields.render_${rt}` as never)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            );
          }}
        />
      )}

      {/* File formats multi-select */}
      {type === 'file' && <FileFormatsField />}

      {/* Label */}
      <FormField
        control={form.control}
        name="label"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('customFields.label')}</FormLabel>
            <FormControl>
              <Input {...field} value={field.value ?? ''} maxLength={CUSTOM_FIELD_LABEL_MAX} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Placeholder */}
      <FormField
        control={form.control}
        name="placeholder"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('customFields.placeholder')}</FormLabel>
            <FormControl>
              <Input
                {...field}
                value={field.value ?? ''}
                maxLength={CUSTOM_FIELD_PLACEHOLDER_MAX}
                disabled={placeholderDisabled}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Mask (text, number) */}
      {(type === 'text' || type === 'number') && (
        <FormField
          control={form.control}
          name="mask"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('customFields.mask')}</FormLabel>
              <FormControl>
                <Input {...field} value={field.value ?? ''} maxLength={CUSTOM_FIELD_MASK_MAX} />
              </FormControl>
              <a
                href={MASK_HELP_URL}
                target="_blank"
                rel="noreferrer"
                className="text-primary inline-flex items-center gap-1 text-xs hover:underline"
              >
                {t('customFields.maskLearn')}
                <ExternalLink className="h-3 w-3" />
              </a>
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      {/* Character limit (text) / decimal length (number) */}
      {type === 'text' && <NumberStepperField name="characterLimit" label={t('customFields.characterLimit')} />}
      {type === 'number' && <NumberStepperField name="decimalLength" label={t('customFields.decimalLength')} />}

      {/* List options */}
      {type === 'list' && (
        <div className="col-start-1">
          <OptionsField />
        </div>
      )}

      {/* Attribution type (all except file) */}
      {type !== 'file' && (
        <div className="col-span-full">
          <AttributionTypeField isEditing={isEditing} />
        </div>
      )}
    </div>
  );
}

/** Multi-select of allowed file formats, backed by the `fileFormats` array. */
function FileFormatsField() {
  const { t } = useTranslation();
  const form = useFormContext<CustomFieldFormValues>();
  const selected = form.watch('fileFormats') ?? [];

  const toggle = (fmt: string, checked: boolean) => {
    const next = checked ? [...selected, fmt] : selected.filter((f) => f !== fmt);
    form.setValue('fileFormats', next, { shouldDirty: true });
  };

  return (
    <FormItem>
      <FormLabel>{t('customFields.fileFormat')}</FormLabel>
      <Popover>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" className="w-full justify-between font-normal">
            {t('customFields.selectFiles')}
            {selected.length > 0 && (
              <span className="bg-muted ml-2 rounded-full px-2 text-xs">{selected.length}</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[--radix-popover-trigger-width] p-2">
          {FILE_FORMATS.map((fmt) => (
            <label key={fmt} className="hover:bg-muted flex cursor-pointer items-center gap-2 rounded-sm p-2 text-sm">
              <Checkbox checked={selected.includes(fmt)} onCheckedChange={(c) => toggle(fmt, c === true)} />
              <span className="uppercase">{fmt}</span>
            </label>
          ))}
        </PopoverContent>
      </Popover>
    </FormItem>
  );
}

/** Number input with +/- steppers, clamped at 0. */
function NumberStepperField({ name, label }: { name: 'characterLimit' | 'decimalLength'; label: string }) {
  const { t } = useTranslation();
  const form = useFormContext<CustomFieldFormValues>();
  const value = Number(form.watch(name) ?? 0);

  const set = (next: number) => form.setValue(name, Math.max(0, next), { shouldDirty: true });

  return (
    <FormItem>
      <FormLabel>{label}</FormLabel>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          min={0}
          value={Number.isFinite(value) ? value : 0}
          onChange={(e) => set(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
          className="w-20"
        />
        <div className="flex flex-col">
          <button type="button" onClick={() => set(value + 1)} className="text-muted-foreground hover:text-foreground">
            <ChevronUp className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => set(value - 1)} className="text-muted-foreground hover:text-foreground">
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>
        <span className="text-muted-foreground text-sm">{t('customFields.characters')}</span>
      </div>
    </FormItem>
  );
}

/** Editable, drag-reorderable list of option strings (for `list` type). */
function OptionsField() {
  const { t } = useTranslation();
  const form = useFormContext<CustomFieldFormValues>();
  const options = form.watch('options') ?? [''];

  const commit = (next: string[]) => form.setValue('options', next, { shouldDirty: true });

  const update = (index: number, val: string) => commit(options.map((o, i) => (i === index ? val : o)));
  const add = () => commit([...options, '']);
  const remove = (index: number) => commit(options.filter((_, i) => i !== index));

  const onDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData('text/plain', String(index));
    e.dataTransfer.effectAllowed = 'move';
  };
  const onDrop = (e: React.DragEvent, target: number) => {
    e.preventDefault();
    const from = Number(e.dataTransfer.getData('text/plain'));
    if (Number.isNaN(from) || from === target) return;
    const next = [...options];
    const [moved] = next.splice(from, 1);
    next.splice(target, 0, moved);
    commit(next);
  };

  return (
    <div className="space-y-2">
      <Label>{t('customFields.options')}</Label>
      <div className="space-y-2">
        {options.map((option, index) => (
          <div
            key={index}
            draggable
            onDragStart={(e) => onDragStart(e, index)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => onDrop(e, index)}
            className="flex items-center gap-2"
          >
            <GripVertical className="text-muted-foreground h-4 w-4 shrink-0 cursor-grab" />
            <Input
              value={option}
              placeholder={t('customFields.optionPlaceholder')}
              onChange={(e) => update(index, e.target.value)}
            />
            {options.length > 1 && (
              <button
                type="button"
                onClick={() => remove(index)}
                className="text-muted-foreground hover:text-destructive shrink-0"
                aria-label={t('common.delete')}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
      </div>
      <Button type="button" variant="outline" size="sm" onClick={add}>
        <Plus className="mr-1 h-4 w-4" />
        {t('customFields.addOption')}
      </Button>
    </div>
  );
}

/** Radio group for attribution behaviour; locked when editing. */
function AttributionTypeField({ isEditing }: { isEditing: boolean }) {
  const { t } = useTranslation();
  const form = useFormContext<CustomFieldFormValues>();
  const value = form.watch('attributionType') ?? 'first';

  return (
    <div className="space-y-2">
      <Label>{t('customFields.attributionType')}</Label>
      <div className="space-y-2">
        {ATTRIBUTION_TYPES.map((opt) => {
          const selected = value === opt;
          return (
            <label
              key={opt}
              className={cn(
                'flex cursor-pointer items-start gap-2',
                isEditing && 'cursor-not-allowed opacity-60',
              )}
            >
              <input
                type="radio"
                name="attributionType"
                className="accent-primary mt-1"
                checked={selected}
                disabled={isEditing}
                onChange={() => form.setValue('attributionType', opt, { shouldDirty: true })}
              />
              <span className="flex flex-col">
                <span className={cn('text-sm', selected && 'text-primary font-medium')}>
                  {t(`customFields.attribution_${opt}_title` as never)}
                </span>
                <span className="text-muted-foreground text-sm">
                  {t(`customFields.attribution_${opt}_desc` as never)}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

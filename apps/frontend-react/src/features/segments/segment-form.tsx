import { useRef, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { UnsavedChangesDialog } from '@/components/unsaved-changes-dialog';
import { segmentFormSchema, SEGMENT_NAME_MAX, SEGMENT_DESCRIPTION_MAX, type SegmentFormValues } from './segment-schema';
import { BuilderProvider } from './builder/builder-context';
import { ConditionBuilder } from './builder/condition-builder';
import { parseSteps, serializeSteps } from './builder/builder-serializer';
import { validateBuilder } from './builder/builder-validator';
import { useValidateSegmentName } from './builder/use-validate-segment-name';
import { StatusBanner } from './builder/status-banner';
import type { BuilderState } from './builder/types';
import type { Segment } from './types';

interface SegmentFormProps {
  defaultValues?: SegmentFormValues;
  onSubmit: (data: SegmentFormValues) => void;
  isPending: boolean;
  segment?: Segment;
}

export function SegmentForm({ defaultValues, onSubmit, isPending, segment }: SegmentFormProps) {
  const { t } = useTranslation();
  const isEditing = defaultValues !== undefined;
  const segmentId = segment?.id;

  // Parse initial builder state from the steps JSON string
  const initialCards = useMemo(() => parseSteps(defaultValues?.steps ?? '[]'), [defaultValues?.steps]);

  // Track builder state via ref (updated by BuilderProvider callback)
  const builderStateRef = useRef<BuilderState>({ cards: initialCards });

  // Name uniqueness validation
  const nameValidation = useValidateSegmentName(segmentId);

  const form = useForm<SegmentFormValues>({
    resolver: zodResolver(segmentFormSchema) as never,
    defaultValues: defaultValues ?? {
      name: '',
      description: '',
      contactsLimit: null,
      recurrence: 24,
      addBounced: false,
      addUnsubscribed: false,
      addInvalid: false,
      isRealTimeSegment: false,
      isClickhouseSegment: false,
      steps: [],
    },
  });

  const nameLength = form.watch('name')?.length ?? 0;
  const descriptionLength = form.watch('description')?.length ?? 0;

  // Submit interception: validate name + builder first, then form
  const handleSubmit = () => {
    // Block submit during name validation
    if (!nameValidation.canSubmit) {
      if (nameValidation.state === 'validating') {
        toast.info(t('segments.builder.nameValidating', 'Verificando nome...'));
      }
      return;
    }

    const builderErrors = validateBuilder(builderStateRef.current);
    if (builderErrors.length > 0) {
      for (const error of builderErrors) {
        toast.error(error.message);
      }
      return;
    }

    form.handleSubmit((formValues) => {
      // Serialize builder state and merge with form values
      const steps = serializeSteps(builderStateRef.current.cards);
      onSubmit({ ...formValues, steps });
    })();
  };

  return (
    <>
      <UnsavedChangesDialog isDirty={form.formState.isDirty} isPending={isPending} />
      <Form {...form}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
          className="space-y-6"
        >
          {/* Status Banner */}
          <StatusBanner status={segment?.status} isProcessing={segment?.isProcessing} />

          {/* Basic Info */}
          <div className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel>{t('segments.name')}</FormLabel>
                    <div className="flex items-center gap-2">
                      {nameValidation.state === 'validating' && (
                        <Loader2 className="text-muted-foreground h-3 w-3 animate-spin" />
                      )}
                      {nameValidation.state === 'valid' && <CheckCircle2 className="h-3 w-3 text-emerald-500" />}
                      {nameValidation.state === 'invalid' && <XCircle className="text-destructive h-3 w-3" />}
                      <span className="text-muted-foreground text-xs">
                        {t('validation.charCount', { count: nameLength, max: SEGMENT_NAME_MAX })}
                      </span>
                    </div>
                  </div>
                  <FormControl>
                    <Input
                      {...field}
                      maxLength={SEGMENT_NAME_MAX}
                      onChange={(e) => {
                        field.onChange(e);
                        nameValidation.validate(e.target.value);
                      }}
                    />
                  </FormControl>
                  {nameValidation.state === 'invalid' && (
                    <p className="text-destructive text-[0.8rem] font-medium">
                      {t('segments.builder.nameExists', 'Este nome já está em uso')}
                    </p>
                  )}
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
                    <FormLabel>{t('segments.description')}</FormLabel>
                    <span className="text-muted-foreground text-xs">
                      {t('validation.charCount', {
                        count: descriptionLength,
                        max: SEGMENT_DESCRIPTION_MAX,
                      })}
                    </span>
                  </div>
                  <FormControl>
                    <Textarea rows={3} {...field} maxLength={SEGMENT_DESCRIPTION_MAX} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Contacts Limit */}
          <FormField
            control={form.control}
            name="contactsLimit"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('segments.contactsLimit')}</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="number"
                    min="0"
                    onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                    value={field.value ?? ''}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Condition Builder */}
          <div className="space-y-4">
            <h3 className="text-muted-foreground text-sm font-medium">{t('segments.builder.conditionGroupLabel')}</h3>
            <BuilderProvider
              initialCards={initialCards}
              isDisabled={isPending}
              onStateChange={(state) => {
                builderStateRef.current = state;
              }}
            >
              <ConditionBuilder />
            </BuilderProvider>
          </div>

          <Button type="submit" disabled={isPending}>
            {isPending ? t('common.loading') : isEditing ? t('common.save') : t('common.create')}
          </Button>
        </form>
      </Form>
    </>
  );
}

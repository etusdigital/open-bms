import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ZodSchema } from 'zod';

interface FormWrapperProps {
  schema: ZodSchema;
  defaultValues: Record<string, unknown>;
  children: React.ReactNode;
}

export function FormWrapper({ schema, defaultValues, children }: FormWrapperProps) {
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues,
  });

  return <FormProvider {...form}>{children}</FormProvider>;
}

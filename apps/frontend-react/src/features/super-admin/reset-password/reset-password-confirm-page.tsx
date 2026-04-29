import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { useNavigate } from '@tanstack/react-router';
import { useMutation } from '@tanstack/react-query';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api-client';
import { extractApiErrorMessage } from '@/lib/api-error';

const schema = z
  .object({
    newPassword: z.string().min(10),
    confirmPassword: z.string().min(10),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type FormValues = z.infer<typeof schema>;

interface ResetPasswordConfirmPageProps {
  token: string;
}

export function ResetPasswordConfirmPage({ token }: ResetPasswordConfirmPageProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema) as never,
    defaultValues: { newPassword: '', confirmPassword: '' },
  });

  const mutation = useMutation({
    mutationFn: async (data: FormValues) => {
      await apiClient.post('/auth/reset-password/confirm', {
        token,
        newPassword: data.newPassword,
      });
    },
    onSuccess: () => {
      navigate({ to: '/login' });
    },
    onError: (error) => {
      const message = extractApiErrorMessage(error) ?? t('resetPassword.invalidToken');
      form.setError('root', { message });
    },
  });

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <h1 className="text-2xl font-semibold">{t('resetPassword.pageTitle')}</h1>

        <Form {...form}>
          <form onSubmit={form.handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
            <FormField
              control={form.control}
              name="newPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('resetPassword.newPassword')}</FormLabel>
                  <FormControl>
                    <Input {...field} type="password" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('resetPassword.confirmPassword')}</FormLabel>
                  <FormControl>
                    <Input {...field} type="password" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {form.formState.errors.root && (
              <div role="alert" className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
                {form.formState.errors.root.message}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={mutation.isPending}>
              {mutation.isPending ? t('common.loading') : t('resetPassword.submit')}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}

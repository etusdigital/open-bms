import { useRef } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Camera, Check, X, Eye, EyeOff } from 'lucide-react';
import { z } from 'zod/v4';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAppStore } from '@/stores/app-store';
import { useUpdateProfile, useUpdatePassword, useUploadAvatar } from './api';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState } from 'react';

// --- Schemas ---

function createProfileSchema(_t: (key: string) => string) {
  return z.object({
    name: z.string().min(1),
    email: z.string().email(),
    language: z.string(),
  });
}

function createPasswordSchema(t: (key: string) => string) {
  return z
    .object({
      password: z
        .string()
        .min(10, t('profile.passwordMinLength'))
        .refine(
          (val) => {
            const types = [/[A-Z]/.test(val), /[a-z]/.test(val), /[0-9]/.test(val), /[^A-Za-z0-9]/.test(val)].filter(
              Boolean,
            ).length;
            return types >= 3;
          },
          { message: t('profile.passwordComplexity') },
        ),
      confirmPassword: z.string(),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: t('profile.passwordMismatch'),
      path: ['confirmPassword'],
    });
}

type ProfileFormValues = z.infer<ReturnType<typeof createProfileSchema>>;
type PasswordFormValues = z.infer<ReturnType<typeof createPasswordSchema>>;

// --- Password strength indicator ---

function PasswordStrength({ password }: { password: string }) {
  const { t } = useTranslation();

  const checks = [
    { key: 'hasUppercase', test: /[A-Z]/.test(password) },
    { key: 'hasLowercase', test: /[a-z]/.test(password) },
    { key: 'hasNumber', test: /[0-9]/.test(password) },
    { key: 'hasSpecial', test: /[^A-Za-z0-9]/.test(password) },
  ];

  return (
    <ul className="mt-2 space-y-1 text-xs">
      {checks.map(({ key, test }) => (
        <li key={key} className="flex items-center gap-1.5">
          {test ? <Check className="h-3 w-3 text-green-600" /> : <X className="text-muted-foreground h-3 w-3" />}
          <span className={test ? 'text-green-600' : 'text-muted-foreground'}>{t(`profile.${key}` as any)}</span>
        </li>
      ))}
    </ul>
  );
}

// --- Main component ---

export default function ProfilePage() {
  const { t } = useTranslation();
  const auth = useAppStore((s) => s.auth);

  if (auth.status !== 'authenticated') return null;

  const isDatabaseUser = auth.user.providerId?.startsWith('auth0|');

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <h1 className="text-2xl font-semibold">{t('profile.title')}</h1>

      <div className="w-full space-y-6 lg:w-1/2">
        <ProfileInfoSection isDatabaseUser={isDatabaseUser} />
        {isDatabaseUser && <PasswordSection />}
      </div>
    </div>
  );
}

// --- Avatar Section ---

function AvatarSection() {
  const { t } = useTranslation();
  const auth = useAppStore((s) => s.auth);
  const uploadAvatar = useUploadAvatar();
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (auth.status !== 'authenticated') return null;

  const { user } = auth;
  const initials = user.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadAvatar.mutate(file);
    // Reset so the same file can be re-selected
    e.target.value = '';
  };

  return (
    <div className="flex items-center gap-6">
      <div className="relative">
        <Avatar className="h-20 w-20">
          <AvatarImage src={user.profile} alt={user.name} />
          <AvatarFallback className="text-lg">{initials}</AvatarFallback>
        </Avatar>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadAvatar.isPending}
          aria-label={t('profile.changeAvatar')}
          className="border-background bg-primary text-primary-foreground hover:bg-primary/90 absolute -right-1 -bottom-1 flex h-8 w-8 items-center justify-center rounded-full border-2 shadow-sm disabled:opacity-50"
        >
          <Camera className="h-4 w-4" />
        </button>
      </div>
      <div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadAvatar.isPending}
        >
          {t('profile.changePhoto')}
        </Button>
      </div>
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
    </div>
  );
}

// --- Profile Info Section ---

function ProfileInfoSection({ isDatabaseUser }: { isDatabaseUser: boolean }) {
  const { t, i18n } = useTranslation();
  const auth = useAppStore((s) => s.auth);
  const updateProfile = useUpdateProfile();

  const profileSchema = createProfileSchema(t as (key: string) => string);
  const user = auth.status === 'authenticated' ? auth.user : null;

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user?.name ?? '',
      email: user?.email ?? '',
      language: i18n.language,
    },
  });

  if (!user) return null;

  const onSubmit = (values: ProfileFormValues) => {
    updateProfile.mutate({
      name: values.name,
      email: values.email,
      settings: { language: values.language },
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('profile.personalInfo')}</CardTitle>
        <CardDescription>{t('profile.personalInfoDescription')}</CardDescription>
      </CardHeader>
      <CardContent>
        <AvatarSection />
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="mt-6 space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('profile.name')}</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('profile.email')}</FormLabel>
                  <FormControl>
                    <Input type="email" disabled={!isDatabaseUser} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="language"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('profile.language')}</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="pt-BR">{t('profile.languagePtBR')}</SelectItem>
                      <SelectItem value="en-US">{t('profile.languageEnUS')}</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" disabled={updateProfile.isPending}>
              {updateProfile.isPending ? t('profile.saving') : t('profile.save')}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

// --- Password Section ---

function PasswordSection() {
  const { t } = useTranslation();
  const auth = useAppStore((s) => s.auth);
  const updatePassword = useUpdatePassword();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const passwordSchema = createPasswordSchema(t as (key: string) => string);

  const form = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  });

  if (auth.status !== 'authenticated') return null;

  const passwordValue = form.watch('password');

  const onSubmit = (values: PasswordFormValues) => {
    updatePassword.mutate(
      { password: values.password },
      {
        onSuccess: () => {
          form.reset();
        },
      },
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('profile.changePassword')}</CardTitle>
        <CardDescription>{t('profile.changePasswordDescription')}</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('profile.newPassword')}</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input type={showPassword ? 'text' : 'password'} {...field} />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label={showPassword ? t('profile.hidePassword') : t('profile.showPassword')}
                        className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage />
                  {passwordValue && <PasswordStrength password={passwordValue} />}
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('profile.confirmPassword')}</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input type={showConfirm ? 'text' : 'password'} {...field} />
                      <button
                        type="button"
                        onClick={() => setShowConfirm(!showConfirm)}
                        aria-label={showConfirm ? t('profile.hidePassword') : t('profile.showPassword')}
                        className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2"
                      >
                        {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" disabled={updatePassword.isPending}>
              {updatePassword.isPending ? t('profile.updatingPassword') : t('profile.updatePassword')}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

import { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormField, FormItem, FormLabel, FormControl, FormDescription } from '@/components/ui/form';
import { ListPage } from '@/components/list-page';
import { selectIsSuperAdmin, useAppStore } from '@/stores/app-store';
import { useAccountConfig, useAccountId, useTimezone, useUpdateAccountConfigs } from './use-settings';
import { SETTINGS_TABS, type SettingsTab } from './types';
import { SendgridAccountTab } from './sendgrid-account-tab';
import { PoolTab } from './pool-tab';

export default function SettingsPage() {
  const { t } = useTranslation();
  const isSuperAdmin = useAppStore(selectIsSuperAdmin);
  const [tab, setTab] = useState<SettingsTab>('general');

  const visibleTabs = useMemo<SettingsTab[]>(
    () => (isSuperAdmin ? [...SETTINGS_TABS, 'pool'] : SETTINGS_TABS),
    [isSuperAdmin],
  );

  return (
    <ListPage.Root>
      <ListPage.Header title={t('settings.pageTitle')} />

      <ListPage.Toolbar>
        <div className="flex items-center gap-2">
          {visibleTabs.map((tabKey) => (
            <Button
              key={tabKey}
              variant={tab === tabKey ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTab(tabKey)}
            >
              {t(`settings.tab${tabKey.charAt(0).toUpperCase() + tabKey.slice(1)}` as never)}
            </Button>
          ))}
        </div>
      </ListPage.Toolbar>

      <ListPage.Content>
        <div className="p-6">
          {tab === 'general' && <GeneralTab />}
          {tab === 'email' && <EmailTab />}
          {tab === 'sendgrid' && <SendgridAccountTab />}
          {tab === 'pool' && isSuperAdmin && <PoolTab />}
        </div>
      </ListPage.Content>
    </ListPage.Root>
  );
}

function GeneralTab() {
  const { t } = useTranslation();
  const apiKey = useAccountConfig('api_key');
  const apiKeyTracker = useAccountConfig('api_key_tracker');
  const timezone = useTimezone();
  const unsubscribeUrl = useAccountConfig('unsubscribe_redirect_url');
  const defaultDomain = useAccountConfig('default_domain');

  const fields = [
    { label: t('settings.apiKey'), value: apiKey },
    { label: t('settings.apiKeyTracker'), value: apiKeyTracker },
    { label: t('settings.timezone'), value: timezone },
    { label: t('settings.unsubscribeUrl'), value: unsubscribeUrl },
    { label: t('settings.defaultDomain'), value: defaultDomain },
  ];

  return (
    <div className="max-w-lg space-y-4">
      {fields.map((field) => (
        <div key={field.label}>
          <label className="text-muted-foreground text-sm font-medium">{field.label}</label>
          <Input value={field.value || '—'} disabled className="mt-1" />
        </div>
      ))}
    </div>
  );
}

function EmailTab() {
  const { t } = useTranslation();
  const accountId = useAccountId();
  const currentLimit = useAccountConfig('send_limit_per_user');
  const updateConfigs = useUpdateAccountConfigs();

  const form = useForm({
    defaultValues: {
      sendLimitPerUser: currentLimit || '0',
    },
  });

  const handleSubmit = useCallback(
    (data: { sendLimitPerUser: string }) => {
      updateConfigs.mutate({
        accountId,
        configs: [
          {
            account_id: accountId,
            name: 'send_limit_per_user',
            value: data.sendLimitPerUser,
          },
        ],
      });
    },
    [accountId, updateConfigs],
  );

  return (
    <div className="max-w-lg">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="sendLimitPerUser"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('settings.sendLimitPerUser')}</FormLabel>
                <FormControl>
                  <Input {...field} type="number" min={0} />
                </FormControl>
                <FormDescription>{t('settings.sendLimitHelp')}</FormDescription>
              </FormItem>
            )}
          />

          <Button type="submit" disabled={updateConfigs.isPending}>
            {updateConfigs.isPending ? t('common.loading') : t('common.save')}
          </Button>
        </form>
      </Form>
    </div>
  );
}

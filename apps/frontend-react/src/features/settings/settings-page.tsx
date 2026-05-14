import { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormField, FormItem, FormLabel, FormControl } from '@/components/ui/form';
import { ListPage } from '@/components/list-page';
import { selectIsSuperAdmin, useAppStore } from '@/stores/app-store';
import { useAccountConfig, useAccountId, useTimezone, useUpdateAccountConfigs } from './use-settings';
import { SETTINGS_TABS, type SettingsTab } from './types';
import { EmailProvidersTab } from './email-providers';
import { PoolTab } from './pool-tab';
import { ApiKeysTab } from './api-keys-tab';
import { usePermissions } from '@/hooks/use-permissions';
import { TimezoneCombobox } from '@/components/timezone-combobox';

export default function SettingsPage() {
  const { t } = useTranslation();
  const isSuperAdmin = useAppStore(selectIsSuperAdmin);
  const { can } = usePermissions();
  const [tab, setTab] = useState<SettingsTab>('general');

  const visibleTabs = useMemo<SettingsTab[]>(() => {
    const tabs: SettingsTab[] = [...SETTINGS_TABS];
    if (!can('account:api_keys_view')) {
      const idx = tabs.indexOf('api_keys');
      if (idx !== -1) tabs.splice(idx, 1);
    }
    if (isSuperAdmin) tabs.push('pool');
    return tabs;
  }, [isSuperAdmin, can]);

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
          {tab === 'email_providers' && <EmailProvidersTab />}
          {tab === 'api_keys' && <ApiKeysTab />}
          {tab === 'pool' && isSuperAdmin && <PoolTab />}
        </div>
      </ListPage.Content>
    </ListPage.Root>
  );
}

function GeneralTab() {
  const { t } = useTranslation();
  const timezone = useTimezone();
  const unsubscribeUrl = useAccountConfig('unsubscribe_redirect_url');
  const defaultDomain = useAccountConfig('default_domain');
  const accountId = useAccountId();
  const updateConfigs = useUpdateAccountConfigs();

  const form = useForm({
    values: {
      timezone: timezone || '',
      unsubscribeUrl: unsubscribeUrl || '',
      defaultDomain: defaultDomain || '',
    },
  });

  const handleSubmit = useCallback(
    (data: { timezone: string; unsubscribeUrl: string; defaultDomain: string }) => {
      const configs = [
        { account_id: accountId, name: 'timezone', value: data.timezone },
        { account_id: accountId, name: 'unsubscribe_redirect_url', value: data.unsubscribeUrl },
        { account_id: accountId, name: 'default_domain', value: data.defaultDomain },
      ];
      updateConfigs.mutate({ accountId, configs });
    },
    [accountId, updateConfigs],
  );

  return (
    <div className="max-w-lg space-y-4">
      <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="timezone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('settings.timezone')}</FormLabel>
                  <FormControl>
                    <TimezoneCombobox
                      value={field.value}
                      onChange={field.onChange}
                      placeholder={t('settings.generalTimezoneSelect')}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="unsubscribeUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('settings.unsubscribeUrl')}</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="https://" />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="defaultDomain"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('settings.defaultDomain')}</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="exemplo.com" />
                  </FormControl>
                </FormItem>
              )}
            />
            <Button type="submit" disabled={updateConfigs.isPending || !form.formState.isDirty}>
              {updateConfigs.isPending ? t('common.loading') : t('common.save')}
            </Button>
          </form>
        </Form>
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

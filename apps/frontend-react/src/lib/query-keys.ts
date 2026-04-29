import type { ListSearchParams } from '@/hooks/use-list-search-params';

export function createEntityQueryKeys(entity: string) {
  return {
    all: [entity] as const,
    list: (accountId: number, params: ListSearchParams) => [entity, 'list', { accountId, ...params }] as const,
    detail: (accountId: number, id: number) => [entity, 'detail', { accountId, id }] as const,
    dashboard: (accountId: number) => [entity, 'dashboard', { accountId }] as const,
    history: (accountId: number, id: number, filters?: Record<string, unknown>) =>
      [entity, 'history', { accountId, id, ...filters }] as const,
  };
}

export const queryKeys = {
  users: {
    all: ['users'] as const,
    me: (accountId: number) => ['users', 'me', { accountId }] as const,
  },
  accounts: {
    configs: (accountId: number) => ['accounts', 'configs', { accountId }] as const,
  },
  tags: createEntityQueryKeys('tags'),
  customFields: createEntityQueryKeys('custom-fields'),
  labels: createEntityQueryKeys('labels'),
  customEvents: createEntityQueryKeys('custom-events'),
  pools: createEntityQueryKeys('pools'),
  segments: createEntityQueryKeys('segments'),
  contacts: createEntityQueryKeys('contacts'),
  templates: createEntityQueryKeys('templates'),
  messages: {
    ...createEntityQueryKeys('messages'),
    clickStatistics: (messageId: number, filterId: number, filterType: 'campaign' | 'automation') =>
      ['messages', 'click-statistics', { messageId, filterId, filterType }] as const,
  },
  campaigns: createEntityQueryKeys('campaigns'),
  automations: {
    ...createEntityQueryKeys('automations'),
    messageStats: (
      automationId: number,
      emailIds: number[],
      webPushIds: number[],
      mobilePushIds: number[],
      daysFilter: number,
    ) =>
      ['automations', 'message-statistics', { automationId, emailIds, webPushIds, mobilePushIds, daysFilter }] as const,
    stats: (automationId: number) => ['automations', 'statistics', { automationId }] as const,
    goalStats: (automationId: number, startDate: string, endDate: string) =>
      ['automations', 'goal-stats', { automationId, startDate, endDate }] as const,
    audits: (automationId: number) => ['automations', 'audits', { automationId }] as const,
  },
  superAdmin: {
    accounts: {
      all: ['super-admin', 'accounts', 'all'] as const,
      detail: (id: number) => ['super-admin', 'accounts', 'detail', id] as const,
    },
    users: {
      all: ['super-admin', 'users', 'all'] as const,
      list: (params: ListSearchParams) => ['super-admin', 'users', 'list', params] as const,
      detail: (id: number) => ['super-admin', 'users', 'detail', id] as const,
    },
  },
} as const;

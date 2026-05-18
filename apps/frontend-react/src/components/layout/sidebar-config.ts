import {
  BarChart3,
  Megaphone,
  Workflow,
  Mail,
  Users,
  Server,
  ShieldCheck,
  ShieldAlert,
  Tag,
  Settings,
} from 'lucide-react';
import type { Permission } from '@/types';

export interface NavItem {
  labelKey: string;
  icon?: typeof BarChart3;
  route?: string;
  permission?: Permission;
  superAdminOnly?: boolean;
  internalOnly?: boolean;
  exactMatch?: boolean;
  children?: NavItem[];
}

export const MENU_ITEMS: NavItem[] = [
  {
    labelKey: 'sidebar.statistics',
    icon: BarChart3,
    permission: 'analytics:dashboard_view',
    children: [
      {
        labelKey: 'sidebar.emailStatistics',
        route: '/analytics/dashboard',
        permission: 'analytics:dashboard_view',
      },
      {
        labelKey: 'sidebar.comparison',
        route: '/analytics/compare',
        permission: 'analytics:comparison_view',
      },
    ],
  },
  {
    labelKey: 'sidebar.campaigns',
    icon: Megaphone,
    route: '/campaigns',
    permission: 'campaigns:view',
  },
  {
    labelKey: 'sidebar.automations',
    icon: Workflow,
    route: '/automations',
    permission: 'automations:view',
  },
  {
    labelKey: 'sidebar.messages',
    icon: Mail,
    permission: 'messages:view',
    children: [
      {
        labelKey: 'sidebar.viewAll',
        route: '/messages',
        permission: 'messages:view',
        exactMatch: true,
      },
      {
        labelKey: 'sidebar.addMessage',
        route: '/messages/email/create',
        permission: 'messages:create',
      },
      {
        labelKey: 'sidebar.transactional',
        route: '/messages/transactional',
        permission: 'messages:view',
        internalOnly: true,
      },
      {
        labelKey: 'sidebar.templates',
        route: '/templates',
        permission: 'messages:view',
      },
    ],
  },
  {
    labelKey: 'sidebar.twoFa',
    icon: ShieldCheck,
    route: '/messages/2fa',
    permission: 'messages:view',
    internalOnly: true,
  },
  {
    labelKey: 'sidebar.contacts',
    icon: Users,
    permission: 'audience:contacts_view',
    children: [
      {
        labelKey: 'sidebar.contacts',
        route: '/contacts',
        permission: 'audience:contacts_view',
      },
      {
        labelKey: 'sidebar.segments',
        route: '/segments',
        permission: 'audience:segments_view',
      },
      {
        labelKey: 'sidebar.tags',
        route: '/tags',
        permission: 'audience:tags_view',
      },
      {
        labelKey: 'sidebar.customFields',
        route: '/customfields',
        permission: 'audience:custom_fields_view',
      },
      {
        labelKey: 'sidebar.customEvents',
        route: '/custom-events',
        permission: 'audience:custom_fields_view',
        internalOnly: true,
      },
      {
        labelKey: 'sidebar.unsubscribed',
        route: '/contacts/suppressions/unsubscribed',
        permission: 'audience:contacts_suppress',
      },
      {
        labelKey: 'sidebar.blocked',
        route: '/contacts/suppressions/blocked',
        permission: 'audience:contacts_suppress',
      },
    ],
  },
  {
    labelKey: 'sidebar.pools',
    icon: Server,
    route: '/pools',
    permission: 'infra:view',
  },
  {
    labelKey: 'sidebar.labels',
    icon: Tag,
    route: '/labels',
    permission: 'infra:view',
    internalOnly: true,
  },
  {
    labelKey: 'sidebar.superAdmin',
    icon: ShieldAlert,
    superAdminOnly: true,
    children: [
      {
        labelKey: 'sidebar.superAdminAccounts',
        route: '/super-admin/accounts',
        superAdminOnly: true,
      },
      {
        labelKey: 'sidebar.superAdminImportEnterprise',
        route: '/super-admin/accounts/import-enterprise',
        superAdminOnly: true,
      },
      {
        labelKey: 'sidebar.superAdminUsers',
        route: '/super-admin/users',
        superAdminOnly: true,
      },
      {
        labelKey: 'sidebar.superAdminIntegrations',
        route: '/super-admin/integrations',
        superAdminOnly: true,
      },
    ],
  },
];

export const SETTINGS_ITEM: NavItem = {
  labelKey: 'sidebar.settings',
  icon: Settings,
  route: '/settings',
  permission: 'account:settings_view',
};

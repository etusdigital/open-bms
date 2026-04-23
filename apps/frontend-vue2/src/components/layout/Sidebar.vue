<template>
  <div class="sidebar">
    <div class="double-sidebar">
      <div class="main-sidebar">
        <v-app-bar-nav-icon
          v-show="!drawer"
          class="hidden-md-and-up"
          @click.stop="drawer = !drawer"
        ></v-app-bar-nav-icon>
        <v-navigation-drawer
          clipped
          v-model="drawer"
          left
          :permanent="$vuetify.breakpoint.mdAndUp"
          app
          class="dark"
          :width="width"
        >
          <v-app-bar href="/" class="no-shadow justify-content-center header-sidebar">
            <router-link to="/" target="_self" class="brius-logo-name">
              <img
                class="logo"
                src="../../assets/brius-sidebar-logo.svg"
                title="BMS - Brius Message System"
                width="32"
              />
              <span v-if="width === 272" class="logo-name">BRIUS MESSAGE SERVICE</span>
            </router-link>
          </v-app-bar>

          <v-list class="sidebar__list">
            <v-list-item
              v-if="!currentAccount.isInternal && can('campaigns:view')"
              :class="[$route.path.includes('/campaigns') ? 'active-class' : 'disable', ' pl-0']"
            >
              <router-link to="/campaigns" class="d-flex align-items-center flex no-underline p-0">
                <div v-tooltip.right="$t('sidebar.campaigns')" class="d-flex" v-if="hidden">
                  <span class="material-symbols-rounded mx-1">campaign</span>
                </div>
                <template v-else>
                  <span class="material-symbols-rounded mx-1">campaign</span>
                  <span class="sidebar__item-list-text item-text ml-2">
                    {{ $t('sidebar.campaigns') }}
                  </span>
                </template>
              </router-link>
            </v-list-item>
            <v-list-item
              v-else-if="currentAccount.isInternal && can('campaigns:view')"
              @mouseover="hoverCampaigns = true"
              @mouseleave="hoverCampaigns = false"
              class="message-sidebar"
              :class="[
                ($route.path.includes('/campaign') && !$route.path.includes('/campaign-')) ||
                $route.path.includes('/trigger-campaign')
                  ? 'active-class'
                  : 'disable',
                'pl-0',
                isSidebarCollapsed ? 'message-gap-close' : 'message-gap-open',
              ]"
            >
              <button
                id="menu-activator"
                class="d-flex align-items-center message-button flex"
                v-on:click="openCampaignMenu = !openCampaignMenu"
                @click="$router.push('/campaigns')"
              >
                <div v-tooltip.top="$t('sidebar.campaigns')" class="d-flex" v-if="hidden">
                  <span
                    class="material-symbols-rounded font-20 mx-1 mt-1"
                    :class="[
                      ($route.path.includes('/campaign') && !$route.path.includes('/campaign-')) ||
                      $route.path.includes('/trigger-campaign')
                        ? 'ds-blue-color'
                        : 'ds-gray-color',
                    ]"
                    >campaign</span
                  >
                </div>
                <template v-else>
                  <div class="d-flex align-items-center">
                    <span
                      class="material-symbols-rounded font-20 mx-1 mt-1"
                      :class="[
                        ($route.path.includes('/campaign') && !$route.path.includes('/campaign-')) ||
                        $route.path.includes('/trigger-campaign')
                          ? 'ds-blue-color'
                          : 'ds-gray-color',
                      ]"
                    >
                      campaign
                    </span>
                    <span class="sidebar__item-list-text item-text ml-2" :hidden="hidden">
                      {{ $t('sidebar.campaigns') }}
                    </span>
                  </div>
                  <div class="d-flex">
                    <span
                      class="material-symbols-rounded"
                      :class="[
                        ($route.path.includes('/campaign') && !$route.path.includes('/campaign-')) ||
                        $route.path.includes('/trigger-campaign')
                          ? 'ds-blue-color'
                          : 'ds-gray-color',
                      ]"
                      >arrow_right</span
                    >
                  </div>
                </template>
              </button>
              <div class="message-menu div-column" v-show="hoverCampaigns">
                <router-link
                  :to="campaign.router"
                  :class="[{ 'message-menu-active': campaign.paths.includes(`${$route.name}`) }]"
                  class="messages-actions"
                  v-for="campaign in availableCampaignPages"
                  :key="campaign.title"
                >
                  {{ campaign.title }}
                </router-link>
              </div>
            </v-list-item>

            <v-list-item
              v-if="can('automations:view')"
              :class="[$route.path.includes('/automations/emails') ? 'active-class' : 'disable', 'pl-0']"
            >
              <router-link to="/automations/emails" class="d-flex align-items-center flex no-underline p-0">
                <div v-tooltip.right="$t('sidebar.automations')" class="d-flex" v-if="hidden">
                  <span class="material-symbols-rounded font-20 mx-1">account_tree</span>
                </div>
                <template v-else>
                  <span class="material-symbols-rounded font-20 mx-1">account_tree</span>
                  <span class="sidebar__item-list-text item-text ml-2" :hidden="hidden">{{
                    $t('sidebar.automations')
                  }}</span>
                </template>
              </router-link>
            </v-list-item>

            <v-list-item
              v-if="can('messages:view')"
              @mouseover="hoverMessages = true"
              @mouseleave="hoverMessages = false"
              class="message-sidebar"
              :class="[
                ($route.path.includes('/messages') && !$route.path.includes('/messages/2FA')) ||
                $route.path.includes('/templates')
                  ? 'active-class'
                  : 'disable',
                'pl-0',
                isSidebarCollapsed ? 'message-gap-close' : 'message-gap-open',
              ]"
            >
              <button
                id="menu-activator"
                class="d-flex align-items-center message-button flex justify-between"
                v-on:click="openMessageMenu = !openMessageMenu"
              >
                <div
                  v-tooltip.top="$t('sidebar.messages')"
                  class="d-flex"
                  :class="[
                    $route.path.includes('/messages') && !$route.path.includes('/messages/2FA')
                      ? 'ds-blue-color'
                      : 'ds-gray-color',
                  ]"
                  v-if="hidden"
                >
                  <span class="material-symbols-rounded font-20 mx-1 mt-1">send</span>
                </div>
                <template v-else>
                  <div class="d-flex align-items-center">
                    <span
                      class="material-symbols-rounded font-20 mx-1 mt-1"
                      :class="[
                        $route.path.includes('/messages') && !$route.path.includes('/messages/2FA')
                          ? 'ds-blue-color'
                          : 'ds-gray-color',
                      ]"
                    >
                      send
                    </span>
                    <span class="sidebar__item-list-text item-text ml-2" :hidden="hidden">
                      {{ $t('sidebar.messages') }}
                    </span>
                  </div>
                  <div class="d-flex">
                    <span
                      class="material-symbols-rounded"
                      :class="[
                        $route.path.includes('/messages') && !$route.path.includes('/messages/2FA')
                          ? 'ds-blue-color'
                          : 'ds-gray-color',
                      ]"
                      >arrow_right</span
                    >
                  </div>
                </template>
              </button>
              <div class="message-menu div-column" v-show="hoverMessages">
                <router-link
                  :to="message.router"
                  :class="[{ 'message-menu-active': message.paths.includes(`${$route.name}`) }]"
                  class="messages-actions"
                  v-for="message in availableMessagesPages"
                  :key="message.title"
                >
                  {{ message.title }}
                </router-link>
              </div>
            </v-list-item>

            <v-list-item
              v-if="can('audience:contacts_view')"
              @mouseover="hoverContacts = true"
              @mouseleave="hoverContacts = false"
              class="message-sidebar"
              :class="[
                $route.path.includes('/contacts') ||
                $route.path.includes('/tags') ||
                $route.path.includes('/leads') ||
                $route.path.includes('/customfields') ||
                $route.path.includes('/suppressions/unsubscribed') ||
                $route.path.includes('/suppressions/blocked')
                  ? 'active-class'
                  : 'disable',
                'pl-0',
                isSidebarCollapsed ? 'message-gap-close' : 'message-gap-open',
              ]"
            >
              <button
                id="menu-activator"
                class="d-flex align-items-center message-button-contacts flex"
                v-on:click="openContactsMenu = !openContactsMenu"
              >
                <div v-tooltip.top="$t('sidebar.contacts')" class="d-flex" v-if="hidden">
                  <span
                    class="material-symbols-rounded font-20 mx-1 mt-1"
                    :class="[
                      $route.path.includes('/contacts') ||
                      $route.path.includes('/leads') ||
                      $route.path.includes('/tags') ||
                      $route.path.includes('/customfields') ||
                      $route.path.includes('/suppressions/unsubscribed') ||
                      $route.path.includes('/suppressions/blocked')
                        ? 'ds-blue-color'
                        : 'ds-gray-color',
                    ]"
                    >group</span
                  >
                </div>
                <template v-else>
                  <div class="d-flex align-items-center">
                    <span
                      class="material-symbols-rounded font-20 mx-1 mt-1"
                      :class="[$route.path.includes('/contacts') ? 'ds-blue-color' : 'ds-gray-color']"
                    >
                      group
                    </span>
                    <span class="sidebar__item-list-text item-text ml-2" :hidden="hidden">
                      {{ $t('sidebar.contacts') }}
                    </span>
                  </div>
                  <div class="d-flex">
                    <span
                      class="material-symbols-rounded"
                      :class="[$route.path.includes('/contacts') ? 'ds-blue-color' : 'ds-gray-color']"
                      >arrow_right</span
                    >
                  </div>
                </template>
              </button>
              <div class="message-menu div-column" v-show="hoverContacts">
                <router-link
                  :to="message.router"
                  :class="[{ 'message-menu-active': message.paths.includes(`${$route.name}`) }]"
                  class="messages-actions"
                  v-for="message in availableContactPages"
                  :key="message.title"
                >
                  {{ message.title }}
                </router-link>
              </div>
            </v-list-item>

            <v-list-item
              v-if="can('audience:segments_view')"
              :class="[$route.path.includes('/segments') ? 'active-class' : 'disable', 'pl-0']"
            >
              <router-link to="/segments" class="d-flex align-items-center flex no-underline p-0">
                <div v-tooltip.right="$t('sidebar.segments')" class="d-flex" v-if="hidden">
                  <span class="material-symbols-rounded font-20 mx-1">track_changes</span>
                </div>
                <template v-else>
                  <span class="material-symbols-rounded font-20 mx-1">track_changes</span>
                  <span class="sidebar__item-list-text item-text ml-2" :hidden="hidden">{{
                    $t('sidebar.segments')
                  }}</span>
                </template>
              </router-link>
            </v-list-item>
            <v-list-item
              v-if="currentAccount.isInternal && can('infra:view')"
              :class="[$route.path.includes('/custom-events') ? 'active-class' : 'disable', 'pl-0']"
            >
              <router-link to="/custom-events" class="d-flex align-items-center flex no-underline p-0">
                <div v-tooltip.right="$t('sidebar.customEvents')" class="d-flex" v-if="hidden">
                  <span class="material-symbols-rounded font-20 mx-1">bolt</span>
                </div>
                <template v-else>
                  <span class="material-symbols-rounded font-20 mx-1">bolt</span>
                  <span class="sidebar__item-list-text item-text ml-2" :hidden="hidden">{{
                    $t('sidebar.customEvents')
                  }}</span>
                </template>
              </router-link>
            </v-list-item>
            <v-list-item
              v-if="currentAccount.isInternal && can('infra:view')"
              :class="[$route.path.includes('/pools') ? 'active-class' : 'disable', 'pl-0']"
            >
              <router-link to="/pools" class="d-flex align-items-center flex no-underline p-0">
                <div v-tooltip.right="$t('sidebar.pools')" class="d-flex" v-if="hidden">
                  <span class="material-symbols-rounded font-20 mx-1">rule_settings</span>
                </div>
                <template v-else>
                  <span class="material-symbols-rounded font-20 mx-1">rule_settings</span>
                  <span class="sidebar__item-list-text item-text ml-2" :hidden="hidden">{{ $t('sidebar.pools') }}</span>
                </template>
              </router-link>
            </v-list-item>
            <v-list-item
              v-if="currentAccount.isInternal && can('infra:view')"
              :class="[$route.path.includes('/warmups') ? 'active-class' : 'disable', 'pl-0']"
            >
              <router-link to="/warmups" class="d-flex align-items-center flex no-underline p-0">
                <div v-tooltip.right="$t('sidebar.warmups')" class="d-flex" v-if="hidden">
                  <span class="material-symbols-rounded font-20 mx-1">rocket_launch</span>
                </div>
                <template v-else>
                  <span class="material-symbols-rounded font-20 mx-1">rocket_launch</span>
                  <span class="sidebar__item-list-text item-text ml-2" :hidden="hidden">
                    {{ $t('sidebar.warmups') }}
                  </span>
                </template>
              </router-link>
            </v-list-item>
            <v-list-item
              v-if="currentAccount.isInternal && can('analytics:insights_view')"
              :class="[$route.path.includes('/insights') ? 'active-class' : 'disable', 'pl-0']"
            >
              <router-link to="/insights" class="d-flex align-items-center flex no-underline p-0">
                <div v-tooltip.right="$t('sidebar.insights')" class="d-flex" v-if="hidden">
                  <span class="material-symbols-rounded font-20 mx-1">lightbulb</span>
                </div>
                <template v-else>
                  <span class="material-symbols-rounded font-20 mx-1">lightbulb</span>
                  <span class="sidebar__item-list-text item-text ml-2" :hidden="hidden">
                    {{ $t('sidebar.insights') }}
                  </span>
                </template>
              </router-link>
            </v-list-item>

            <v-list-item
              v-if="currentAccount.isInternal && can('infra:manage')"
              :class="[$route.path.includes('/messages/2FA') ? 'active-class' : 'disable', 'pl-0']"
            >
              <router-link to="/messages/2FA/email" class="d-flex align-items-center flex no-underline p-0">
                <div v-tooltip.right="$t('sidebar.2FA')" class="d-flex" v-if="hidden">
                  <span class="material-symbols-rounded font-20 mx-1">security</span>
                </div>
                <template v-else>
                  <span class="material-symbols-rounded font-20 mx-1">security</span>
                  <span
                    :class="[$route.path.includes('/messages/2FA') ? 'ds-blue-color' : '']"
                    class="sidebar__item-list-text item-text ml-2"
                    :hidden="hidden"
                    >{{ $t('sidebar.2FA') }}</span
                  >
                </template>
              </router-link>
            </v-list-item>

            <v-list-item
              v-if="currentAccount.isInternal && can('infra:manage')"
              @mouseover="hoverCampaignsRules = true"
              @mouseleave="hoverCampaignsRules = false"
              class="message-sidebar"
              :class="[
                $route.path.includes('/campaign-rules') || $route.path.includes('/campaign-configs')
                  ? 'active-class'
                  : 'disable',
                'pl-0',
                isSidebarCollapsed ? 'message-gap-close' : 'message-gap-open',
              ]"
            >
              <button
                id="menu-activator"
                class="d-flex align-items-center message-button-contacts flex"
                v-on:click="openCampaignRulesMenu = !openCampaignRulesMenu"
              >
                <div v-tooltip.top="$t('sidebar.campaignRules')" class="d-flex" v-if="hidden">
                  <span
                    class="material-symbols-rounded font-20 mx-1 mt-1"
                    :class="[
                      $route.path.includes('/campaign-rules') || $route.path.includes('/campaign-configs')
                        ? 'ds-blue-color'
                        : 'ds-gray-color',
                    ]"
                    >extension</span
                  >
                </div>
                <template v-else>
                  <div class="d-flex align-items-center">
                    <span
                      class="material-symbols-rounded font-20 mx-1 mt-1"
                      :class="[$route.path.includes('/campaign-rules') ? 'ds-blue-color' : 'ds-gray-color']"
                    >
                      extension
                    </span>
                    <span class="sidebar__item-list-text item-text ml-2" :hidden="hidden">
                      {{ $t('sidebar.campaignRules') }}
                    </span>
                  </div>
                  <div class="d-flex">
                    <span
                      class="material-symbols-rounded"
                      :class="[$route.path.includes('/campaign-rules') ? 'ds-blue-color' : 'ds-gray-color']"
                      >arrow_right</span
                    >
                  </div>
                </template>
              </button>
              <div class="message-menu div-column" v-show="hoverCampaignsRules">
                <router-link
                  :to="message.router"
                  :class="[{ 'message-menu-active': message.paths.includes(`${$route.name}`) }]"
                  class="messages-actions"
                  v-for="message in availableCampaignConfigPages"
                  :key="message.title"
                >
                  {{ message.title }}
                </router-link>
              </div>
            </v-list-item>

            <v-list-item
              v-if="currentAccount.isInternal && can('infra:view')"
              :class="[$route.path.includes('/labels') ? 'active-class' : 'disable', 'pl-0']"
            >
              <router-link to="/labels" class="d-flex align-items-center flex no-underline p-0">
                <div v-tooltip.right="$t('sidebar.labels')" class="d-flex" v-if="hidden">
                  <span class="material-symbols-rounded font-20 mx-1">label</span>
                </div>
                <template v-else>
                  <span class="material-symbols-rounded font-20 mx-1">label</span>
                  <span
                    :class="[$route.path.includes('/labels') ? 'ds-blue-color' : '']"
                    class="sidebar__item-list-text item-text ml-2"
                    :hidden="hidden"
                    >{{ $t('sidebar.labels') }}</span
                  >
                </template>
              </router-link>
            </v-list-item>
          </v-list>

          <template v-slot:append>
            <v-list class="sidebar__list">
              <v-list-item
                v-if="can('account:settings_view')"
                :class="[$route.path.includes('/settings') ? 'active-class' : 'disable', 'pl-0']"
              >
                <router-link to="/settings" class="d-flex align-items-center flex no-underline p-0">
                  <div v-tooltip.right="$t('sidebar.settings')" class="d-flex" v-if="hidden">
                    <span class="material-symbols-rounded mx-1"> settings </span>
                  </div>
                  <template v-else>
                    <span class="material-symbols-rounded mx-1"> settings </span>
                    <span class="sidebar__item-list-text ml-2" :hidden="hidden">{{ $t('sidebar.settings') }}</span>
                  </template>
                </router-link>
              </v-list-item>
            </v-list>
            <button class="material-symbols-rounded sidebar_button mb-5 sidebar_open" @click="hideSideBar()">
              {{ icon }}
            </button>
          </template>
        </v-navigation-drawer>
      </div>
    </div>
    <v-main
      :class="{
        'app-format-margin': width === 272,
        'padding-main': width === 272,
        'padding-main-sub': isSidebarCollapsed === false,
        'padding-hover': width === 80,
      }"
    >
      <slot name="app-content"></slot>
    </v-main>
  </div>
</template>

<script lang="ts">
import { Component, Vue, Watch } from 'vue-property-decorator';
import { mapState } from 'vuex';
import { AccountDto } from '@/modules/accounts/dtos/account.dto';
import store from '@/store';

@Component({
  components: {},
  computed: {
    ...mapState(['isSuperAdmin', 'currentAccount', 'accountChannels', 'isSuportUser']),
  },
})
export default class Sidebar extends Vue {
  public isSuperAdmin!: boolean;
  public isSuportUser!: boolean;
  public currentAccount!: AccountDto;
  public accountChannels!: any;

  drawer = true;
  subDrawer = false;
  width = 272;
  hidden = false;
  icon = 'arrow_forward_ios';
  isSidebarCollapsed = false;
  messagesPages: any = [];
  contactPages: any = [];
  campaignConfigsPages: any = [];
  campaignsPages: any = [];
  openMessageMenu = false;
  openContactsMenu = false;
  openCampaignRulesMenu = false;
  openCampaignMenu = false;
  hoverMessages = false;
  hoverContacts = false;
  hoverCampaignsRules = false;
  hoverCampaigns = false;

  can(permission: string) {
    return store.getters.can(permission);
  }

  get availableMessagesPages() {
    return this.messagesPages.filter((message: any) => !message.permission || this.can(message.permission));
  }

  get availableContactPages() {
    return this.contactPages.filter((contact: any) => !contact.permission || this.can(contact.permission));
  }

  get availableCampaignConfigPages() {
    return this.campaignConfigsPages.filter((item: any) => !item.permission || this.can(item.permission));
  }

  get availableCampaignPages() {
    return this.campaignsPages.filter((item: any) => !item.permission || this.can(item.permission));
  }

  beforeMount() {
    this.messagesPages = [
      {
        title: this.$t('sidebar.seeAll'),
        router: this.definedRouterMessage(),
        paths: ['list-web-push', 'list-mobile-push', 'list-automations-message', 'list-sms', 'list-whatsapp'],
        permission: 'messages:view',
      },
      {
        title: this.$t('sidebar.createNewMessage'),
        router: '/messages/email/new',
        paths: ['messages-create'],
        permission: 'messages:create',
      },
      {
        title: this.$t('sidebar.dashboard'),
        router: '/messages/email/statistics',
        paths: ['statistics-route'],
        permission: 'analytics:dashboard_view',
      },
      {
        title: this.$t('sidebar.messageComparison'),
        router: '/messages/email/comparison',
        paths: ['comparison-route'],
        permission: 'analytics:comparison_view',
      },
      {
        title: this.$t('title.emailReputation'),
        router: '/messages/postmaster',
        paths: ['postmaster'],
        permission: 'infra:view',
      },
      {
        title: this.$t('sidebar.transactional'),
        router: '/automations/transactional',
        paths: ['transactional'],
        permission: 'automations:view',
      },
      {
        title: this.$t('sidebar.templates'),
        router: '/templates',
        paths: ['list-templates'],
        permission: 'messages:view',
      },
    ];

    this.campaignConfigsPages = [
      {
        title: this.$t('sidebar.campaignRules'),
        router: '/campaign-rules',
        paths: ['campaigns-rules', 'campaign-rule-create', 'campaign-rule-edit'],
        permission: 'infra:manage',
      },
      {
        title: this.$t('sidebar.campaignConfigs'),
        router: '/campaign-rules-configs',
        paths: ['campaign-rules-configs', 'campaign-config-create', 'campaign-config-edit'],
        permission: 'infra:manage',
      },
    ];

    this.campaignsPages = [
      {
        title: this.$t('sidebar.regularCampaign'),
        router: '/campaigns',
        paths: ['news-campaigns', 'news-campaigns-create', 'news-campaigns-template-create', 'news-campaigns-edit'],
        permission: 'campaigns:view',
      },
      {
        title: this.$t('sidebar.triggerCampaign'),
        router: '/trigger-campaign',
        paths: ['list-trigger-campaign', 'new-trigger-campaign', 'edit-trigger-campaign'],
        permission: 'campaigns:view',
      },
      {
        title: this.$t('sidebar.products'),
        router: '/product',
        paths: ['list-trigger-products', 'new-trigger-products', 'edit-trigger-products'],
        permission: 'campaigns:view',
      },
    ];

    this.contactPages = [
      {
        title: this.$t('sidebar.seeAll2'),
        router: '/contacts',
        paths: ['list-contacts'],
        permission: 'audience:contacts_view',
      },
      {
        title: this.$t('sidebar.newContacts'),
        router: '/contacts/new',
        paths: ['list-conctactsnew'],
        permission: 'audience:contacts_import',
      },
      {
        title: this.$t('sidebar.tags'),
        router: '/tags',
        paths: ['list-tags'],
        permission: 'audience:tags_view',
      },
      {
        title: this.$t('sidebar.customFields'),
        router: '/customfields',
        paths: ['list-customfields'],
        permission: 'audience:custom_fields_view',
      },
    ];
    if (this.currentAccount.isInternal) {
      this.contactPages.push({
        title: this.$t('title.leads'),
        router: '/leads',
        paths: ['leads-route'],
        permission: 'analytics:insights_view',
      });
    }
    if (this.can('audience:contacts_suppress')) {
      this.contactPages.push({
        title: this.$t('sidebar.unsubscribe'),
        router: '/contacts/suppressions/unsubscribed',
        paths: ['list-contacts'],
        permission: 'audience:contacts_suppress',
      });
      this.contactPages.push({
        title: this.$t('sidebar.block'),
        router: '/contacts/suppressions/blocked',
        paths: ['list-contacts'],
        permission: 'audience:contacts_suppress',
      });
    }
    this.isSidebarCollapsed = window.localStorage.getItem('bms-sidebar-collapsed') === 'true';
    this.checkSidebar();
  }

  hideSideBar() {
    this.isSidebarCollapsed = !this.isSidebarCollapsed;
    window.localStorage.setItem('bms-sidebar-collapsed', `${this.isSidebarCollapsed}`);
  }

  @Watch('isSidebarCollapsed')
  checkSidebar() {
    this.width = this.isSidebarCollapsed ? 80 : 272;
    this.hidden = this.isSidebarCollapsed ? true : false;
    this.icon = this.isSidebarCollapsed ? 'arrow_forward_ios' : 'arrow_back_ios';
  }

  definedRouterMessage() {
    if (this.accountChannels.hasEmail) {
      return '/messages/email';
    }
    if (this.accountChannels.hasWebPush) {
      return '/messages/web-push';
    }
    if (this.accountChannels.hasMobilePush) {
      return '/messages/mobile-push';
    }
    if (this.accountChannels.hasSms) {
      return '/messages/sms';
    }
    return '/messages/whatsapp';
  }
}
</script>

<style lang="scss" scoped>
@import '@/assets/styles/variables.scss';

@media (max-width: 1000px) {
  .sub-sidebar {
    display: none;
  }
}

.brius-logo-name {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 15px;
  padding-top: 20px;
  &:hover {
    text-decoration: none;
  }
}
.logo-name {
  text-transform: uppercase;
  font-style: normal;
  font-weight: 600;
  font-size: 12px;
  color: $ds-blue;
  letter-spacing: 1.2px;
  white-space: nowrap;
  place-content: center;
}
.append-sub {
  height: 35px;
  display: flex;
  place-content: center;
  padding-left: 50px;
}
.sub-sidebar {
  font-size: 10px;
  color: $ds-gray-300;
}
.sub-sidebar a:hover {
  color: $ds-blue;
}
.sub-sidebar-header {
  display: flex;
  gap: 60px;
}
.sub-close {
  color: $ds-gray-300;
  align-self: start;
  top: -15px;

  &:hover {
    color: $ds-blue;
  }
}

.sidebar__list {
  margin-top: 10px;
}

.app-format-margin {
  padding: 0px 0px 0px 272px !important;
}
.sidebar {
  display: flex;
  flex-direction: row;
  padding-left: 40px;
  border-top-left-radius: 100px;
  border-top-right-radius: 100px;
  height: 100%;
}
.header-sidebar {
  border-top-left-radius: 100px;
  border-top-right-radius: 100px;
}
::v-deep.v-toolbar {
  border-top-left-radius: 100px !important;
  border-top-right-radius: 100px !important;
}

.main-sidebar {
  border-bottom-left-radius: 100px;
  border-bottom-right-radius: 100px;
}
.logo {
  margin-left: 0.5em;
  max-width: fit-content;
}
div.sidebar__list > div.v-list-item.active-class {
  background: hsla(218, 100%, 98%, 1);
}

div.sidebar__list > div.v-list-item:hover {
  background: $ds-gray-100;
  transition: all 0.25s;
  border-radius: 6px;
}

.dark {
  background-color: #ffffff !important;
  box-shadow:
    0px 1px 2px rgba(0, 0, 0, 0.06),
    0px 1px 3px rgba(0, 0, 0, 0.1) !important;
  border-radius: 16px;
  margin-top: 35px;
  max-height: 90vh !important;
  z-index: 9 !important;
}

.no-shadow {
  background-color: #ffffff !important;
  box-shadow: none !important;
}

.active-class .item-text {
  font-weight: 400;
  color: $ds-blue;
}

.active-class {
  opacity: 1;
  margin-left: 16px !important;
  margin-right: 16px !important;
  transition: all 0.25s;
  left: 0px;
  border-radius: 6px;
}
.active-class-group {
  margin-left: 4px !important;
}
.active-class a.router-link-exact-active,
.active-class .item-icon,
a.router-link-exact-active .sidebar__item-list-text,
.active-class .sidebar__item-list-title,
.sub-sidebar .router-link-exact-active {
  color: $ds-blue;
}

.active-class img {
  filter: invert(12%) sepia(100%) saturate(6234%) hue-rotate(219deg) brightness(96%) contrast(156%);
}

.active-class .messages-sidebar .sidebar__item-list-text,
a.router-link-exact-active,
.sub-sidebar .router-link-exact-active {
  font-weight: 400;
}

.active-class .message-button .sidebar__item-list-text {
  font-weight: 400;
  color: $ds-blue;
}

.sidebar__item-list-text,
.item-icon,
.active-class a:not(.router-link-active) > .sidebar__item-list-text {
  color: $ds-gray;
}

.icons-sidebar {
  padding: 12px;
}

a.router-link-exact-active > .sidebar__item-list-text {
  font-weight: 400;
  letter-spacing: 0.1em;
}

.disable {
  margin-left: 16px !important;
  margin-right: 16px !important;
}
.disable-group {
  margin-left: 4px !important;
  margin-right: 16px !important;
}
.disable a {
  color: $ds-gray;
}

div.sidebar__list {
  background: #ffffff !important;
  font-style: normal;
  font-weight: normal;
  font-size: 14px;
  line-height: 19px;

  div.v-list-item {
    display: flex;
    align-items: center;
    justify-content: center;
    max-height: 38px;
    margin: 0.5rem 0;
    padding: 8px !important;
  }

  .md-height {
    height: 56px !important;
  }
  .ma-height {
    height: 45px !important;
  }
}

.sidebar__item-list-text {
  white-space: nowrap;
  font-size: 14px;
}

.sub-sidebar .sidebar__item-list-text {
  font-size: 14px;
  padding: 0 0 0 12px;
  margin-bottom: 12px;
}
.sidebar__item-list-title {
  font-size: 14px;
}

.sub-sidebar .messages-sidebar {
  margin-bottom: 11px;
}

.padding-sub {
  padding-top: 6px;
}

.sidebar__item-list-text a {
  display: inline-block;
}
.sidebar__item-list-text {
  text-transform: capitalize;
  letter-spacing: 0.1em;
  font-weight: 400;
}

.hidden-md-and-up {
  padding: $spacing-lg;
  position: absolute;
  z-index: 999;
}
.hidden-md-and-up .v-btn__content i {
  color: $ds-gray-300;
}
.icon-automations {
  width: 24px;
  height: 24px;
  color: $ds-gray;
}
.no-pointer {
  cursor: auto;
}
.sidebar_open {
  color: #989898;
}
.sidebar_button {
  box-shadow: none;
  display: flex;
  margin-left: 30px;
  width: 100%;
  font-size: 20px;

  &:hover {
    color: $ds-blue;
  }
}

.theme--light.v-icon:focus::after {
  opacity: 0 !important;
}
.theme--light.v-btn:hover::before {
  opacity: 0 !important;
}

.double-sidebar {
  display: flex;
  flex-direction: row;
  position: fixed;
  z-index: 9;
}
.main-sidebar {
  z-index: 9;
}

.sub-sidebar {
  position: relative;
  margin-left: -25px !important;
}

::v-deep.v-navigation-drawer--fixed {
  position: unset !important;
}
.sub-sidebar-title {
  color: $ds-blue;
  letter-spacing: 0.1em;
  font-style: normal;
  font-weight: 600;
  font-size: 14px;
  margin: 0;
  padding: 0;
  line-height: 1em;
}

.revert-icon {
  -webkit-transform: scaleX(-1);
  transform: scaleX(-1);
}

.v-main {
  flex: auto;
}
.padding-main {
  padding: 0px 0px 0px 272px !important;
}
.padding-hover {
  padding: 0px 0px 0px 80px !important;
}
.mdi-icon {
  font-size: 24px;
}

.messages-actions {
  text-decoration: none;
  color: #5c5c5c;
  padding: 8px;
  min-width: 150px;
}

.message-menu {
  background-color: #ffffff;
  border-radius: 16px;
  padding: 8px;
  box-shadow:
    0px 1px 3px 0px rgba(0, 0, 0, 0.1),
    0px 1px 2px 0px rgba(0, 0, 0, 0.06);
  white-space: nowrap;
  float: right;
  position: relative;
  z-index: 99;
  margin-top: -6px;
}

.message-menu .messages-actions:hover {
  background-color: #f5f5f5;
  border-radius: 8px;
}
.message-sidebar {
  flex-direction: row;
  justify-content: space-between !important;
}

.message-gap-close {
  gap: 10px;
}

.message-gap-open {
  width: 88% !important;
  gap: 8px;
}

.message-button {
  gap: 78px;
}

.message-button-contacts {
  gap: 95px;
}

::v-deep div.v-list-item.message-sidebar.theme--light {
  padding-top: 6px !important;
  place-items: start;
}

.message-menu-active {
  color: $ds-blue !important;
}
</style>

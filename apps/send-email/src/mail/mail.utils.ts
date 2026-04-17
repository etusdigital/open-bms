import { Injectable, Inject } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { load } from 'cheerio';
import Handlebars from 'handlebars';
import { Email, SendEmailMessage, Account, AutomationContactsBatch, Contact, CustomFields, ReplaceLinks, Campaign, Automation } from '../interfaces';
import { FormatterUtils } from '../utils/formatter.utils';
import { Email as BatchEmail, MapVariables, DefaultParams } from './mail.interface';

@Injectable()
export class MailUtils {
  private static readonly randomCodeCache = new WeakMap<Request, { [key: string]: string }>();

  constructor(
    private readonly formatterUtils: FormatterUtils,
    @Inject(REQUEST) private readonly request: Request,
  ) {}

  getVariables(customFields: CustomFields[]) {
    const variables = {
      name: '%NAME%',
      firstName: '%FIRSTNAME%',
      lastName: '%LASTNAME%',
      fullName: '%FULLNAME%',
      email: '%EMAIL%',
      hashedEmail: '%HASHEDEMAIL%',
      uuid: '%UUID%',
      id: '%CONTACT_ID%',
      phone: '%PHONE%',
      link: '%LINK%',
      code: '%CODE%',
      city: '%CITY%',
      region: '%REGION%',
      country: '%COUNTRY%',
      dateToday: '%DATE_TODAY%',
      dateTomorrow: '%DATE_TOMORROW%',
      dayWeekToday: '%DAY_OF_WEEK_TODAY%',
      dayWeekTomorrow: '%DAY_OF_WEEK_TOMORROW%',
      monthToday: '%MONTH_TODAY%',
      monthNext: '%MONTH_NEXT%',
      hourNow: '%HOUR_NOW%',
      hourNextHour: '%HOUR_NEXT_HOUR%',
      hourNext6Hours: '%HOUR_NEXT_6_HOUR%',
      hourNext8Hours: '%HOUR_NEXT_8_HOUR%',
      hourNext16Hours: '%HOUR_NEXT_16_HOUR%',
      hourNext23Hours: '%HOUR_NEXT_23_HOUR%',
      random4: '%RANDOM4%',
      random8: '%RANDOM8%',
      random12: '%RANDOM12%',
      messageId: '%MESSAGE_ID%',
      messageName: '%MESSAGE_NAME%',
    };

    for (const customField of customFields) {
      const customFieldName = (customField?.name || customField) as string;
      variables[customFieldName] = `%${customFieldName.toUpperCase()}%`;
    }

    return variables;
  }

  getCategoriesCampaign(email: BatchEmail, campaignId: number, testabMode: boolean, account: Account, utmCampaign: string) {
    const ipPoolName = this.formatterUtils.normalizeString(this.getIppol(email));
    const emailName = this.formatterUtils.normalizeString(email.name || email.title);

    return [
      `source_msgops`,
      `type_campaign`,
      `pool_${ipPoolName}`,
      `campaign_${campaignId}`,
      `id_${emailName}`,
      `message_${email.id}`,
      `account_${account.id}`,
      `utmcampaign_${utmCampaign}`,
      ...(testabMode ? [`testab-message_${emailName}_${campaignId}`, `testab-campaign_${campaignId}`] : [`cid_${emailName}_${campaignId}`, `campaign-id_${campaignId}`]),
    ];
  }

  getCategories(sendEmailMessage: SendEmailMessage | AutomationContactsBatch) {
    const MSGOPS_DEFAULT = 'msgops-default';
    const emailName = this.formatterUtils.normalizeString(sendEmailMessage?.message?.name || sendEmailMessage?.message?.title);
    const emailPool = this.formatterUtils.normalizeString(sendEmailMessage?.message?.ippool || process.env.SENDGRID_IP_POOL);

    const automationType = this.formatterUtils.normalizeString(sendEmailMessage?.automationType || MSGOPS_DEFAULT);
    const automationName = this.formatterUtils.normalizeString(sendEmailMessage?.automationName || MSGOPS_DEFAULT);

    return [
      'source_msgops',
      ...(emailPool ? [`pool_${emailPool}`] : []),
      ...(automationType ? [`type_${automationType}`] : []),
      ...(automationName ? [`automation-name_${automationName}`] : []),
      ...(sendEmailMessage.automationId ? [`automation-id_${sendEmailMessage.automationId}`] : []),
      ...(emailName ? [`id_${emailName}`] : []),
      ...(sendEmailMessage.message && sendEmailMessage.message.id ? [`message_${sendEmailMessage.message.id}`] : []),
      ...(sendEmailMessage.account?.id || sendEmailMessage.contact.accountId ? [`account_${sendEmailMessage.account?.id || sendEmailMessage.contact.accountId}`] : []),
      ...(sendEmailMessage.utmCampaign ? [`utmcampaign_${sendEmailMessage.utmCampaign}`] : []),
      ...(sendEmailMessage.message.isTestabMode ? [`testab-message_${sendEmailMessage.message.id}`] : []),
    ];
  }

  getCategoriesSparkpost(categories: string[]) {
    return categories.reduce((categoriesOjbect, category) => {
      const key = category.split('_')[0];
      const value = category.replace(`${key}_`, '');
      categoriesOjbect[key] = value;
      return categoriesOjbect;
    }, {});
  }

  getDomain(from: string) {
    return from.split('@')[1] || from;
  }

  getIppol(email: BatchEmail | Email) {
    return email.ippool || process.env.SENDGRID_IP_POOL;
  }

  parseVariables(content: string, contact: Contact, account: Account, message: Email | BatchEmail): string {
    if (!this.hasVariable(content)) {
      return content;
    }

    let newContent = content;

    if (contact) {
      const mapVariables = this.mapVariables(contact, account, message);
      const mapVariablesKeys = Object.keys(mapVariables);

      for (const variable of mapVariablesKeys) {
        const variableRegex = new RegExp(variable, 'gim');
        newContent = newContent.replace(variableRegex, mapVariables[variable]);
      }

      return newContent;
    }

    const variables = this.getVariables(account?.customFields || []);
    const variablesKeys = Object.keys(variables);

    for (const variable of variablesKeys) {
      const variableRegex = new RegExp(variable, 'gim');
      const parsedVariable = variable.replace('%', '{{').replace('%', '}}');

      newContent = newContent.replace(variableRegex, parsedVariable);
    }

    return newContent;
  }

  async parseContent(content: string, contact: Contact, account: Account, message: Email | BatchEmail, provider: string): Promise<string> {
    let parsedContent = this.parseVariables(content, contact, account, message);
    if (provider == 'sparkpost') {
      parsedContent = this.parseUnsubscriber(parsedContent, account);
    }

    return await this.processHandlebars(parsedContent, contact);
  }

  parseUnsubscriber(content: string, account: Account): string {
    let unsubscriberURL = account?.linkUnsubscriber;
    if (account && account.accountConfigs) {
      unsubscriberURL = this.getAccountConfig(account.accountConfigs, 'unsubscribe_redirect_url');

      if (!unsubscriberURL) {
        unsubscriberURL = this.getAccountConfig(account.accountConfigs, 'default_domain');
      }
    }

    if (!unsubscriberURL) {
      return content.replace('href="[unsubscribe_link]"', `data-msys-unsubscribe="1" href="[unsubscribe_link]"`);
    }

    return content.replace('href="[unsubscribe_link]"', `data-msys-unsubscribe="1" href="${unsubscriberURL}"`);
  }

  getAccountConfig(accountConfigs, key) {
    if (Array.isArray(accountConfigs)) {
      const { value } = accountConfigs.find((config) => config.name === key) || {};
      return value;
    }

    return accountConfigs[key];
  }

  parseHandlebarsVariables(content: string, account: Account): string {
    if (!this.hasVariable(content)) {
      return content;
    }

    let newContent = content;
    const variables = this.getVariables(account?.customFields || []);
    const variablesKeys = Object.keys(variables);

    for (const variable of variablesKeys) {
      const variableRegex = new RegExp(variables[variable], 'gim');
      const value = variables[variable].replace('%', '{{').replace('%', '}}').replace(/-/g, '_');
      newContent = newContent.replace(variableRegex, value);
    }

    return newContent;
  }

  hasVariable(emailContent: string): boolean {
    return emailContent ? emailContent.includes('%') : false;
  }

  mapVariables(contact: Contact, account: Account, message: Email | BatchEmail, replaceLinks?: ReplaceLinks, onlyKeyName = false): MapVariables {
    const variables: any = this.getVariables(account?.customFields || []);
    const staticVariables = [
      'name',
      'firstName',
      'lastName',
      'fullName',
      'email',
      'hashedEmail',
      'phone',
      'link',
      'code',
      'id',
      'uuid',
      'city',
      'region',
      'country',
      'dateToday',
      'dateTomorrow',
      'dayWeekToday',
      'dayWeekTomorrow',
      'monthToday',
      'monthNext',
      'hourNow',
      'hourNextHour',
      'hourNext6Hours',
      'hourNext8Hours',
      'hourNext16Hours',
      'hourNext23Hours',
      'random4',
      'random8',
      'random12',
      'messageId',
      'messageName',
    ];
    const map = this.getMappedVariables(staticVariables, variables, contact, account, message);

    if (replaceLinks) {
      for (const link of Object.keys(replaceLinks)) {
        const uuid = contact?.uuid || '{{UUID}}';
        const accountId = account.id || '{{ACCOUNTID}}';
        const bmsUrl = Buffer.from(`${replaceLinks[link].url}&bmsu=${uuid}&bmsa=${accountId}`).toString('base64');
        map[`%${link}%`] = `https://bmsclick.${replaceLinks[link].host}/redirect?url=${bmsUrl}`;
      }
    }

    for (const variable of Object.keys(variables)) {
      if (!staticVariables.includes(variable)) {
        map[variables[variable]] = this.getCustomFieldContact(contact, variable);
      }
    }

    // used on batches
    if (onlyKeyName) {
      const newMap = {};

      const allTextReplce = message.content + message.previewText + message.subject;
      const matches = [...allTextReplce.matchAll(/%([A-Za-z0-9_-]+)%/g)];
      const items = matches.map((m) => m[1].toUpperCase());

      Object.keys(map).forEach((key) => {
        const keyWithoutPercent = key.replace(/%/g, '').replace(/-/g, '_');
        if (items.includes(keyWithoutPercent) || (replaceLinks && keyWithoutPercent.includes('LINK'))) {
          newMap[keyWithoutPercent] = map[key];
        }
      });

      return newMap;
    }

    return map;
  }

  getMappedVariables(staticVariables: any, variables: any, contact: Contact, account: Account, message: Email | BatchEmail): MapVariables {
    const language = this.getAccountConfig(account.accountConfigs, 'language') || 'pt-BR';
    const timeZone = this.getAccountConfig(account.accountConfigs, 'time_zone') || 'America/Sao_Paulo';
    return staticVariables.reduce((acc: Record<string, string>, variable: string) => {
      if (variable === 'link') {
        acc[variables[variable]] = contact[variable] || this.getCustomFieldContact(contact, 'link');
        return acc;
      }

      if (variable.includes('random')) {
        acc[variables[variable]] = this.generateRandomAlphanumeric(parseInt(variable.replace('random', ''), 10));
        return acc;
      }

      if (variable.includes('hour') || variable.includes('date') || variable.includes('day') || variable.includes('month')) {
        acc[variables[variable]] = this.getDateFormatted(variable, language, timeZone);
        return acc;
      }

      if (variable.includes('message')) {
        acc[variables[variable]] = message[variable.replace('message', '').toLowerCase()] || '';
        return acc;
      }

      acc[variables[variable]] = contact[variable] || '';
      return acc;
    }, {});
  }

  getDateFormatted(typeDate: string, language: string, timeZone: string) {
    const dateFormatTemplate: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', year: 'numeric' };
    const weekDayFormatTemplate: Intl.DateTimeFormatOptions = { weekday: 'long' };
    const monthFormatTemplate: Intl.DateTimeFormatOptions = { month: 'long' };
    const hourFormatTemplate: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' };
    let actualTemplate: Intl.DateTimeFormatOptions;
    const today = new Date();

    if (typeDate.includes('Tomorrow')) {
      today.setDate(today.getDate() + 1);
    } else if (typeDate === 'monthNext') {
      today.setMonth(today.getMonth() + 1);
    } else if (typeDate.includes('Next') && typeDate.includes('hour')) {
      const quant = typeDate.match(/\d+/g) ? parseInt(typeDate.match(/\d+/g).join(''), 10) : 1;
      today.setHours(today.getHours() + quant);
    }

    if (typeDate.includes('month')) {
      actualTemplate = monthFormatTemplate;
    } else if (typeDate.includes('date')) {
      actualTemplate = dateFormatTemplate;
    } else if (typeDate.includes('dayWeek')) {
      actualTemplate = weekDayFormatTemplate;
    } else if (typeDate.includes('hour')) {
      actualTemplate = hourFormatTemplate;
    }

    return today.toLocaleString(language, { ...actualTemplate, timeZone });
  }

  getCustomFieldContact(contact: Contact, key: string) {
    if (!contact.customFields || Object.keys(contact.customFields).length < 1) {
      return '';
    }

    const fieldKey = Object.keys(contact.customFields).find((customField) => customField === key);
    return contact.customFields[fieldKey] || '';
  }

  createQueryParams(o: Record<string, string | number>) {
    if (o == null || o == undefined) return '';

    return Object.keys(o)
      .map((key) => key + '=' + o[key])
      .join('&');
  }

  createEmailPixel(options: {
    emailContent: string;
    provider: string;
    utmCampaign: string | null;
    messageId: number | string | null;
    automation?: Automation;
    contact?: Contact | null;
    account?: Account | null;
    dynamicLink?: string | null;
    campaign?: Campaign | null;
    isSendgridVariables?: boolean;
    ramdomNumber?: number;
  }): { template: string; replaceLinks: ReplaceLinks } {
    if (!options.emailContent) return null;

    const $ = load(options.emailContent);
    const body = $('body');

    if (options.provider == 'sendgrid') {
      const sendgridOpenTrackingPixel = $('<div>sendgrid_open_tracking</div>');
      if (options.account && (options.account.id == 16 || options.account.id == 2)) {
        body.append(sendgridOpenTrackingPixel);
      } else {
        body.prepend(sendgridOpenTrackingPixel);
      }
    }

    const links = $('a');
    const replaceLinks: ReplaceLinks = {};
    let replaceLinkCount = 1;

    let defaultDomain: URL;
    const accountDomain = this.getAccountConfig(options.account.accountConfigs, 'default_domain');
    const isClickRedirect = this.getAccountConfig(options.account.accountConfigs, 'has_bms_click_redirect');
    let isCampaignsTest = options.campaign && [294116, 295624].includes(options.campaign.id) ? true : false;
    if (accountDomain) {
      defaultDomain = new URL(accountDomain.includes('http') ? accountDomain : `http://${accountDomain.value}`);
    }
    let randomLinkControl = null;
    links.each((_, link) => {
      const $link = $(link);
      let href = $link.attr('href');

      if (href && (href.includes('unsubscribe_link') || href.includes('<%asm_preferences_raw_url%>'))) {
        return;
      }

      try {
        const urlsRandom = JSON.parse(href);
        if (Array.isArray(urlsRandom)) {
          if (!randomLinkControl) {
            const randomLink = Math.floor(Math.random() * (urlsRandom.length || 0));
            randomLinkControl = (urlsRandom.length && urlsRandom[randomLink]) || defaultDomain;
          }
          href = randomLinkControl;
        }
      } catch {}

      if (options.dynamicLink && ['%LINK%', '{{LINK}}'].includes(href)) {
        $link.attr('href', options.dynamicLink);
      }

      if (href) {
        const defaultParams: DefaultParams = {
          utm_source: options.provider || 'sendgrid',
          utm_medium: `email`,
          utm_campaign: this.formatterUtils.slugify(options.utmCampaign),
        };

        if (options.account?.id === 2 && options.campaign) {
          if (href.includes('tracker.cardfacil.com')) {
            defaultParams['campaign_id'] = `c-${options.campaign.id}-${options.messageId}`;
          }
        }

        const url = new URL(href);
        const params = new URLSearchParams(url.search);
        const paramsFromUrl = {};

        for (const key of params.keys()) {
          paramsFromUrl[key] = params.getAll(key).length > 1 ? params.getAll(key) : params.get(key);
        }

        const queryString = this.createQueryParams({
          ...defaultParams,
          ...paramsFromUrl,
        });
        let auxOriginalLink = `${url.origin}${decodeURI(url.pathname)}?${queryString}`;

        //TODO: REDIRECT TEST OLIVEIRA
        if (options.account && options.account.id == 16 && options.messageId == 555704 && options.ramdomNumber > 0.33) {
          if (options.ramdomNumber <= 0.66) {
            auxOriginalLink = `https://vouquitar.com/s1-sg-cartao-de-credito-sicredi-internacional-2/?${queryString}`;
          } else {
            isCampaignsTest = true;
            auxOriginalLink = `https://vouquitar.com/s1-sg-cartao-de-credito-sicredi-internacional-3/?${queryString}`;
          }
        }

        const messagesIdsToFwd = process.env.MESSAGES_TO_ADD_FWD?.split(',') || [];
        if (messagesIdsToFwd.includes(`${options.messageId}`)) {
          const hashedEmail = options.contact?.hashedEmail || '{{HASHEDEMAIL}}';
          $link.attr('href', `https://fwd.${url.host}/interceptor?hashed_email=${hashedEmail}&target_url=${url.origin}${decodeURI(url.pathname)}&${queryString}`);
          return;
        }

        if (url.host.includes('doubleclick.net')) {
          // stop sendgrid tracking for google ads links
          $link.attr('clicktracking', `off`);
          return;
        }

        if (isClickRedirect && !isCampaignsTest) {
          if (options.isSendgridVariables) {
            const replaceProvider = options.provider === 'sparkpost' ? `{{{LINK${replaceLinkCount}}}}` : `{{LINK${replaceLinkCount}}}`;
            $link.attr('href', replaceProvider);
            replaceLinks[`LINK${replaceLinkCount}`] = {
              host: defaultDomain?.host || url.host,
              url: auxOriginalLink,
            };
            replaceLinkCount++;
            return;
          }

          const uuid = options.contact?.uuid || '{{UUID}}';
          const accountId = options.account.id || '{{ACCOUNTID}}';
          const bmsUrl = Buffer.from(`${auxOriginalLink}&bmsu=${uuid}&bmsa=${accountId}`).toString('base64');
          $link.attr('href', `https://bmsclick.${defaultDomain?.host || url.host}/redirect?url=${bmsUrl}`);
          return;
        }

        $link.attr('href', auxOriginalLink);
      }
    });

    $('p').each(function () {
      const content = $(this).text();
      if (content.trim() === '') {
        $(this).html('&nbsp;');
      }
    });

    const template = $.html();
    return { template, replaceLinks };
  }

  createPreviewText(emailContent: string, emailPreviewText: string): string {
    if (!emailContent) return null;

    const $ = load(emailContent);
    const body = $('body');

    const previewText = `
      <span class="preheader" style="color: transparent; display: none; height: 0; max-height: 0; max-width: 0; opacity: 0; overflow: hidden; mso-hide: all; visibility: hidden; width: 0;">${emailPreviewText}</span>
      <div style="display: none; max-height: 0px; overflow: hidden;">
        &#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;
      </div>
    `;

    body.prepend(previewText);

    return $.html();
  }

  async processHandlebars(content, contact: Contact) {
    const template = Handlebars.compile(content);
    return template(contact);
  }

  isMicrosoft(email: string): boolean {
    const microsoft = [/hotmail\.com/, /outlook\.com/, /live\.com/, /msn\.com/, /passport\.com/];
    const provider = email.split('@')[1];
    return microsoft.some((regex) => regex.test(provider));
  }

  generateRandomAlphanumeric(length: number) {
    let requestCache = MailUtils.randomCodeCache.get(this.request);

    if (!requestCache) {
      requestCache = {};
      MailUtils.randomCodeCache.set(this.request, requestCache);
    }

    if (requestCache[length]) {
      return requestCache[length];
    }

    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    const code = Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    requestCache[length] = code;
    return code;
  }
}

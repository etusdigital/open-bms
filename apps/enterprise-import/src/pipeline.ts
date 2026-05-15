import { Injectable } from '@nestjs/common';
import { ImporterStep } from './importers/importer.interface';
import { AccountSettingsImporter } from './importers/account-settings.importer';
import { TagsImporter } from './importers/tags.importer';
import { CustomFieldsImporter } from './importers/custom-fields.importer';
import { LabelsImporter } from './importers/labels.importer';
import { UsersImporter } from './importers/users.importer';
import { EmailTemplatesImporter } from './importers/email-templates.importer';
import { ContactsImporter } from './importers/contacts.importer';
import { CustomEventsImporter } from './importers/custom-events.importer';
import { AutomationsImporter } from './importers/automations.importer';
import { CampaignsImporter } from './importers/campaigns.importer';
import { MessagesImporter } from './importers/messages.importer';
import { StatisticsImporter } from './importers/statistics.importer';

// Ordem importa: dependências de FK precisam vir antes (ex: campaigns antes de
// messages; custom_events antes de campaigns que os referenciem etc.).
@Injectable()
export class ImportPipeline {
  readonly steps: ImporterStep[];

  constructor(
    accountSettings: AccountSettingsImporter,
    tags: TagsImporter,
    customFields: CustomFieldsImporter,
    labels: LabelsImporter,
    users: UsersImporter,
    emailTemplates: EmailTemplatesImporter,
    customEvents: CustomEventsImporter,
    contacts: ContactsImporter,
    automations: AutomationsImporter,
    campaigns: CampaignsImporter,
    messages: MessagesImporter,
    statistics: StatisticsImporter,
  ) {
    this.steps = [accountSettings, tags, customFields, labels, users, emailTemplates, customEvents, contacts, automations, campaigns, messages, statistics];
  }
}

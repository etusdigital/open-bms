import { Injectable } from '@nestjs/common';
import { ImporterStep } from './importers/importer.interface';
import { TagsImporter } from './importers/tags.importer';
import { CustomFieldsImporter } from './importers/custom-fields.importer';
import { LabelsImporter } from './importers/labels.importer';
import { EmailTemplatesImporter } from './importers/email-templates.importer';
import { ContactsImporter } from './importers/contacts.importer';
import { CustomEventsImporter } from './importers/custom-events.importer';
import { AutomationsImporter } from './importers/automations.importer';
import { CampaignsImporter } from './importers/campaigns.importer';
import { MessagesImporter } from './importers/messages.importer';

// Order matters: FK dependencies must come first (e.g. campaigns before
// messages; custom_events before campaigns that reference them).
// Out of scope (manual platform setup): account-settings, instance-config,
// users (imported data is account-scoped; admin is created by the wizard),
// and events_statistics (super-admin-only rollup, unavailable to a key).
@Injectable()
export class ImportPipeline {
  readonly steps: ImporterStep[];

  constructor(
    tags: TagsImporter,
    customFields: CustomFieldsImporter,
    labels: LabelsImporter,
    emailTemplates: EmailTemplatesImporter,
    customEvents: CustomEventsImporter,
    contacts: ContactsImporter,
    automations: AutomationsImporter,
    campaigns: CampaignsImporter,
    messages: MessagesImporter,
  ) {
    this.steps = [tags, customFields, labels, emailTemplates, customEvents, contacts, automations, campaigns, messages];
  }
}

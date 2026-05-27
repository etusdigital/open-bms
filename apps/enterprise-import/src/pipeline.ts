import { Injectable } from '@nestjs/common';
import { ImporterStep } from './importers/importer.interface';
import { TagsImporter } from './importers/tags.importer';
import { CustomFieldsImporter } from './importers/custom-fields.importer';
import { LabelsImporter } from './importers/labels.importer';
import { EmailTemplatesImporter } from './importers/email-templates.importer';
import { ContactsImporter } from './importers/contacts.importer';
import { ContactTagsImporter } from './importers/contact-tags.importer';
import { ContactCustomFieldsImporter } from './importers/contact-custom-fields.importer';
import { AutomationsImporter } from './importers/automations.importer';
import { CampaignsImporter } from './importers/campaigns.importer';
import { MessagesImporter } from './importers/messages.importer';

// Order matters: FK dependencies must come first (e.g. campaigns before
// messages).
// Out of scope (manual platform setup): account-settings, instance-config,
// users (imported data is account-scoped; admin is created by the wizard).
@Injectable()
export class ImportPipeline {
  readonly steps: ImporterStep[];

  constructor(
    tags: TagsImporter,
    customFields: CustomFieldsImporter,
    labels: LabelsImporter,
    emailTemplates: EmailTemplatesImporter,
    contacts: ContactsImporter,
    contactTags: ContactTagsImporter,
    contactCustomFields: ContactCustomFieldsImporter,
    automations: AutomationsImporter,
    campaigns: CampaignsImporter,
    messages: MessagesImporter,
  ) {
    // contactTags / contactCustomFields run after contacts (and after tags /
    // custom-fields respectively) so their src->newId mappings exist when the
    // join rows are resolved.
    this.steps = [tags, customFields, labels, emailTemplates, contacts, contactTags, contactCustomFields, automations, campaigns, messages];
  }
}

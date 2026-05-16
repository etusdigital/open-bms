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
import { StatisticsImporter } from './importers/statistics.importer';

// Ordem importa: dependências de FK precisam vir antes (ex: campaigns antes de
// messages; custom_events antes de campaigns que os referenciem etc.).
// FORA DO ESCOPO do import (removidos — são config manual de setup/plataforma):
//  - config de provider/conta (account-settings)
//  - config global da instância (instance-config)
//  - usuários (users): os dados importados são account-scoped e não dependem
//    de user_id; o admin é criado/vinculado pelo wizard. Migração de users
//    não é feita por nenhum scope.
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
    statistics: StatisticsImporter,
  ) {
    this.steps = [tags, customFields, labels, emailTemplates, customEvents, contacts, automations, campaigns, messages, statistics];
  }
}

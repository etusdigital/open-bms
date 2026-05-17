import { Injectable } from '@nestjs/common';
import { BaseImporter } from './base.importer';
import { ImportContext } from './importer.interface';
import { PagedResponse } from '../enterprise-client/enterprise.client';
import { EmailsTemplatesEntity } from '../entities/emails-templates.entity';

// Preventivo: `emails_templates` NÃO tem @Unique e não tem `uuid` — o único
// campo estável por registro na origem é o `id` do Enterprise (descartado em
// account-scope, que deixa a sequence atribuir o id novo). Com a chave natural
// só `name`, dois templates distintos de mesmo nome colapsariam e a perda
// seria silenciosa (sem constraint pra barrar). Diferente de contacts (uuid)
// não há outra coluna estável pra usar como chave; então embutimos o id de
// origem no próprio `name`, de forma determinística e idempotente.
//
// O BaseImporter calcula a chave natural a partir de `src[nkProp]` (e relê o
// DB por essa coluna), então o `customize` reescreve TANTO `src.name` quanto a
// linha mapeada — assim a chave (src.name) e a coluna persistida (name) ficam
// consistentes e o re-import continua idempotente (o sufixo vem do id estável).
@Injectable()
export class EmailTemplatesImporter extends BaseImporter<EmailsTemplatesEntity> {
  readonly name = 'email-templates';
  protected readonly entity = EmailsTemplatesEntity;
  protected readonly batchSize = 500;
  protected readonly naturalKey = ['name'];

  protected fetchPage(ctx: ImportContext, page: number): Promise<PagedResponse<EmailsTemplatesEntity>> {
    return ctx.client.listEmailTemplates({ page, itemsPerPage: this.batchSize });
  }

  protected async customize(_ctx: ImportContext, src: any, mapped: Record<string, any>): Promise<Record<string, any> | null> {
    const srcId = src?.id;
    if (srcId === undefined || srcId === null) return mapped; // sem id: não dá pra desambiguar
    const suffix = ` #${srcId}`;
    const base = String(src?.name ?? mapped?.name ?? '');
    // Idempotente: se já está no formato sufixado, não acumula.
    const stableName = base.endsWith(suffix) ? base : base.slice(0, 255 - suffix.length) + suffix;
    // A chave natural sai de src[nkProp]; manter src.name e a coluna alinhados.
    src.name = stableName;
    mapped.name = stableName;
    return mapped;
  }
}

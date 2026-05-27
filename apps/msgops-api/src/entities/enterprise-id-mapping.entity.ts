import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

// Tabela de remapeamento Enterprise sourceId → OSS newId, persistida
// pra retomada de jobs scope=account (em scope=instance os IDs são reusados,
// nada cai aqui). PK composto (job_id, entity, source_id) garante idempotência
// no insert; o índice secundário (job_id, entity) acelera o load do cache em
// memória do IdMapper no início do processor.
@Entity('enterprise_id_mappings')
@Index('enterprise_id_mappings_job_entity_idx', ['jobId', 'entity'])
export class EnterpriseIdMappingEntity {
  @PrimaryColumn('uuid', { name: 'job_id' })
  jobId: string;

  @PrimaryColumn('varchar', { name: 'entity', length: 64 })
  entity: string;

  @PrimaryColumn('varchar', { name: 'source_id', length: 64 })
  sourceId: string;

  @Column('varchar', { name: 'new_id', length: 64 })
  newId: string;
}

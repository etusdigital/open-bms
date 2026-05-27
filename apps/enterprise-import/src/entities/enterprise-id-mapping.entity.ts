import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

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

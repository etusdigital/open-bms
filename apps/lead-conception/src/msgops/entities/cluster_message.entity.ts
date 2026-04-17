import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('clusters_messages')
export class ClusterMessageEntity {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column('varchar', { name: 'location', length: 255 })
  location: string;

  @Column('varchar', { name: 'salary', length: 255 })
  salary: string;

  @Column('varchar', { name: 'job', length: 255 })
  job: string;

  @Column('varchar', { name: 'negativado', length: 255 })
  negativado: string;

  @Column('varchar', { name: 'device', length: 255 })
  device: string;

  @Column('varchar', { name: 'vertical', length: 255 })
  vertical: string;

  @Column('varchar', { name: 'source', length: 255 })
  source: string;

  @Column('int', { name: 'message_id' })
  message_id: number;
}

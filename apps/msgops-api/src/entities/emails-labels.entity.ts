import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('emails_labels')
export class EmailsLabelsEntity {
  @PrimaryColumn('int', { name: 'id' })
  id: number;

  @Column('varchar', { name: 'email_type', length: 20 })
  emailType: string;

  @Column('text', { name: 'country' })
  country: string;

  @Column('varchar', { name: 'language', length: 10 })
  language: string;

  @Column('timestamptz', { name: 'processed_at' })
  processedAt: Date;

  @Column('text', { name: 'html' })
  html: string;
}

import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('email_validations')
export class EmailValidateEntity {
  @PrimaryColumn('varchar', { name: 'email', length: 255 })
  email: string;

  @Column('varchar', { name: 'reason', length: 255 })
  reason: string;

  @Column('varchar', { name: 'status', length: 255 })
  status: string;

  @Column('text', { name: 'response' })
  response: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @CreateDateColumn({ name: 'last_open', type: 'timestamptz' })
  lastOpen: Date;

  @CreateDateColumn({ name: 'last_click', type: 'timestamptz' })
  lastClick: Date;

  @CreateDateColumn({ name: 'unsubscribed_at', type: 'timestamptz' })
  unsubscribedAt: Date;

  @CreateDateColumn({ name: 'bounced_at', type: 'timestamptz' })
  bouncedAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

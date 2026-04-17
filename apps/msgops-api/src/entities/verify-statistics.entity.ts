import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('verify_statistics')
export class VerifyStatisticsEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'account_id', type: 'integer' })
  accountId: number;

  @Column({ type: 'date' })
  date: Date;

  @Column({ type: 'varchar' })
  type: string;

  @Column({ type: 'varchar', default: 'default' })
  group: string;

  @Column({ name: 'count_total', type: 'integer' })
  countTotal: number;

  @Column({ name: 'count_success', type: 'integer' })
  countSuccess: number;

  @Column({ name: 'count_error', type: 'integer' })
  countError: number;

  @Column({ name: 'count_verify_validated', type: 'integer' })
  countVerifyValidated: number;

  @Column({ name: 'count_verify_rejected', type: 'integer' })
  countVerifyRejected: number;
}

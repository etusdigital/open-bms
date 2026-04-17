import { Column, Entity, PrimaryGeneratedColumn, BeforeInsert, CreateDateColumn } from 'typeorm';

@Entity('suppressions')
export class SuppressionEntity {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column('int', { name: 'group_id' })
  groupId: number;

  @Column('varchar', { name: 'email', length: 255 })
  email: string;

  @Column('bool', { name: 'is_unsubscribed' })
  isUnsubscribed: boolean;

  @CreateDateColumn({ name: 'unsubscribed_at', type: 'date' })
  unsubscribedAt: Date;

  @Column('bool', { name: 'is_blocked' })
  isBlocked: boolean;

  @Column({ name: 'blocked_at', type: 'date' })
  blockedAt: Date;

  @BeforeInsert()
  setUserDetails() {
    if (this.email) {
      this.email = this.email.toLowerCase();
    }
  }
}

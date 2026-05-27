import { Column, Entity, PrimaryGeneratedColumn, BeforeInsert, AfterLoad } from 'typeorm';
import { maskEmail } from '../utils/masking/email-masker';

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

  @Column('timestamptz', { name: 'unsubscribed_at' })
  unsubscribedAt: Date;

  @Column('bool', { name: 'is_blocked' })
  isBlocked: boolean;

  @Column('timestamptz', { name: 'blocked_at' })
  blockedAt: Date;

  maskedEmail: string;

  @BeforeInsert()
  setUserDetails() {
    if (this.email) {
      this.email = this.email.toLowerCase();
    }
  }

  @AfterLoad()
  setExtraFields() {
    this.maskedEmail = maskEmail(this.email);
  }
}

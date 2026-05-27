import { Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn, Entity, PrimaryGeneratedColumn, OneToMany, ManyToOne, JoinColumn, BeforeUpdate, Unique } from 'typeorm';
import { AccountEntity } from './account.entity';
import { LabelsContentsEntity } from './labels-contents.entity';

@Entity('labels')
@Unique(['accountId', 'name'])
export class LabelsEntity {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column('int', { name: 'account_id' })
  accountId: number;

  @Column('varchar', { name: 'name', length: 100 })
  name: string;

  @Column('text', { name: 'description', nullable: true })
  description?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp', nullable: true })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamp', nullable: true })
  deletedAt: Date;

  @ManyToOne(() => AccountEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'account_id', referencedColumnName: 'id' })
  account: AccountEntity;

  @OneToMany(() => LabelsContentsEntity, (labelsContents) => labelsContents.label, {
    eager: false,
    nullable: true,
    onDelete: 'CASCADE',
  })
  labelsContents?: LabelsContentsEntity[];

  @BeforeUpdate()
  callbeforeupdate() {
    this.updatedAt = new Date();
  }
}

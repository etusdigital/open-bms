import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, OneToMany } from 'typeorm';
import { ContactTagEntity } from './contact-tag.entity';

@Entity('tags')
export class TagEntity {
  @PrimaryGeneratedColumn({ type: 'int', name: 'id' })
  id: number;

  @Column('varchar', { name: 'name', length: 255 })
  name: string;

  @Column('int', { name: 'account_id' })
  accountId: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @OneToMany(() => ContactTagEntity, (contactTag) => contactTag.tag, {
    eager: true,
    nullable: true,
    onDelete: 'CASCADE',
  })
  contactTag?: Array<ContactTagEntity>;
}

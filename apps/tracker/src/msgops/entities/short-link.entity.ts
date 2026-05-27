import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

@Entity('short_links')
export class ShortLinkEntity {
  @PrimaryColumn('varchar', { name: 'short_code', length: 255 })
  shortCode: string;

  @Column('text', { name: 'long_url' })
  longUrl: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}

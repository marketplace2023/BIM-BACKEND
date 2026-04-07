import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Tenant } from '../core/tenant.entity';

@Entity('product_public_category')
@Index('idx_cat_tenant_vertical_parent', [
  'tenant_id',
  'vertical_type',
  'parent_id',
])
@Index('uq_cat_tenant_vertical_slug', ['tenant_id', 'vertical_type', 'slug'], {
  unique: true,
})
export class ProductPublicCategory {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: string;

  @Column({ type: 'bigint', unsigned: true })
  tenant_id: string;

  @ManyToOne(() => Tenant, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ type: 'varchar', length: 50 })
  vertical_type: string;

  @Column({ type: 'bigint', unsigned: true, nullable: true })
  parent_id: string | null;

  @ManyToOne(() => ProductPublicCategory, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'parent_id' })
  parent: ProductPublicCategory | null;

  @Column({ type: 'varchar', length: 150 })
  name: string;

  @Column({ type: 'varchar', length: 180 })
  slug: string;

  @Column({ type: 'int', default: 10 })
  sequence: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  meta_title: string | null;

  @Column({ type: 'text', nullable: true })
  meta_description: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  meta_keywords: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  image_url: string | null;

  @Column({ type: 'tinyint', width: 1, default: 1 })
  active: number;

  @Column({ type: 'tinyint', width: 1, default: 1 })
  show_on_website: number;

  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at: Date;
}

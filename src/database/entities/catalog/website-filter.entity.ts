import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Tenant } from '../core/tenant.entity';
import { ProductPublicCategory } from './product-public-category.entity';

@Entity('website_filter')
export class WebsiteFilter {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: string;

  @Column({ type: 'bigint', unsigned: true })
  tenant_id: string;

  @ManyToOne(() => Tenant, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ type: 'bigint', unsigned: true })
  category_id: string;

  @ManyToOne(() => ProductPublicCategory, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'category_id' })
  category: ProductPublicCategory;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'varchar', length: 50 })
  filter_type: string;

  @Column({ type: 'json', nullable: true })
  config_json: Record<string, any> | null;

  @Column({ type: 'int', default: 10 })
  sequence: number;

  @Column({ type: 'tinyint', width: 1, default: 1 })
  is_active: number;
}

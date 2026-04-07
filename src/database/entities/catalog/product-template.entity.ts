import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { Tenant } from '../core/tenant.entity';
import { ResPartner } from '../identity/res-partner.entity';
import { ProductPublicCategory } from './product-public-category.entity';
import { ProductImage } from './product-image.entity';

@Entity('product_template')
@Index('uq_product_tenant_slug', ['tenant_id', 'slug'], { unique: true })
@Index('idx_product_tenant_vertical', ['tenant_id', 'vertical_type'])
@Index('idx_product_partner', ['partner_id'])
export class ProductTemplate {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: string;

  @Column({ type: 'bigint', unsigned: true })
  tenant_id: string;

  @ManyToOne(() => Tenant, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ type: 'bigint', unsigned: true })
  partner_id: string;

  @ManyToOne(() => ResPartner, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'partner_id' })
  partner: ResPartner;

  @Column({ type: 'bigint', unsigned: true, nullable: true })
  categ_id: string | null;

  @ManyToOne(() => ProductPublicCategory, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'categ_id' })
  category: ProductPublicCategory | null;

  @Column({ type: 'varchar', length: 50 })
  @Index()
  listing_type: string;

  @Column({ type: 'varchar', length: 50 })
  vertical_type: string;

  @Column({ type: 'varchar', length: 190 })
  @Index()
  name: string;

  @Column({ type: 'varchar', length: 220 })
  slug: string;

  @Column({ type: 'text', nullable: true })
  description_sale: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0.0 })
  list_price: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  compare_price: string | null;

  @Column({ type: 'char', length: 3, default: 'USD' })
  currency_code: string;

  @Column({ type: 'varchar', length: 20, default: 'service' })
  type: string;

  @Column({ type: 'tinyint', width: 1, default: 1 })
  sale_ok: number;

  @Column({ type: 'tinyint', width: 1, default: 0 })
  purchase_ok: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  default_code: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  barcode: string | null;

  @Column({ type: 'json', nullable: true })
  x_attributes_json: Record<string, any> | null;

  @Column({ type: 'json', nullable: true })
  seo_json: Record<string, any> | null;

  @Column({ type: 'json', nullable: true })
  cta_json: Record<string, any> | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  cover_image_url: string | null;

  @Column({ type: 'decimal', precision: 3, scale: 2, default: 0.0 })
  rating_avg: string;

  @Column({ type: 'tinyint', width: 1, default: 0 })
  is_published: number;

  @Column({ type: 'tinyint', width: 1, default: 1 })
  active: number;

  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at: Date;

  @Column({ type: 'datetime', nullable: true })
  deleted_at: Date | null;

  @OneToMany(() => ProductImage, (image) => image.product_template)
  images: ProductImage[];
}

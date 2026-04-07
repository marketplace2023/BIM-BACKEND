import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { ProductTemplate } from './product-template.entity';

@Entity('product_product')
@Index('uq_variant_sku', ['sku'], { unique: true })
export class ProductProduct {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: string;

  @Column({ type: 'bigint', unsigned: true })
  @Index()
  product_tmpl_id: string;

  @ManyToOne(() => ProductTemplate, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_tmpl_id' })
  product_template: ProductTemplate;

  @Column({ type: 'varchar', length: 120 })
  sku: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  barcode: string | null;

  @Column({ type: 'json', nullable: true })
  variant_attributes_json: Record<string, any> | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0.0 })
  price_extra: string;

  @Column({ type: 'tinyint', width: 1, default: 1 })
  active: number;
}

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { SaleOrder } from './sale-order.entity';
import { ProductTemplate } from '../catalog/product-template.entity';
import { ProductProduct } from '../catalog/product-product.entity';

@Entity('sale_order_line')
export class SaleOrderLine {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: string;

  @Column({ type: 'bigint', unsigned: true })
  @Index()
  order_id: string;

  @ManyToOne(() => SaleOrder, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: SaleOrder;

  @Column({ type: 'bigint', unsigned: true })
  @Index()
  product_tmpl_id: string;

  @ManyToOne(() => ProductTemplate, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'product_tmpl_id' })
  product_template: ProductTemplate;

  @Column({ type: 'bigint', unsigned: true, nullable: true })
  product_variant_id: string | null;

  @ManyToOne(() => ProductProduct, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'product_variant_id' })
  product_variant: ProductProduct | null;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 1.0 })
  qty: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0.0 })
  price_unit: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0.0 })
  discount: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0.0 })
  subtotal: string;

  @Column({ type: 'json', nullable: true })
  line_meta_json: Record<string, any> | null;
}

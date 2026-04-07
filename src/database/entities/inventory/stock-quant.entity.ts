import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Tenant } from '../core/tenant.entity';
import { ResPartner } from '../identity/res-partner.entity';
import { ProductProduct } from '../catalog/product-product.entity';

@Entity('stock_quant')
@Index(
  'uq_stock_owner_variant_location',
  ['tenant_id', 'partner_id', 'product_variant_id', 'location_code'],
  { unique: true },
)
export class StockQuant {
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

  @Column({ type: 'bigint', unsigned: true })
  product_variant_id: string;

  @ManyToOne(() => ProductProduct, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'product_variant_id' })
  product_variant: ProductProduct;

  @Column({ type: 'varchar', length: 100, nullable: true })
  location_code: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0.0 })
  quantity: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0.0 })
  reserved_quantity: string;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at: Date;
}

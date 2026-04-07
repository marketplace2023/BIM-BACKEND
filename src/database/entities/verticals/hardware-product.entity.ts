import { Entity, Column, OneToOne, JoinColumn, PrimaryColumn } from 'typeorm';
import { ProductTemplate } from '../catalog/product-template.entity';

@Entity('hardware_product')
export class HardwareProduct {
  @PrimaryColumn({ type: 'bigint', unsigned: true })
  product_tmpl_id: string;

  @OneToOne(() => ProductTemplate, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_tmpl_id' })
  product_template: ProductTemplate;

  @Column({ type: 'varchar', length: 120, nullable: true })
  brand: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  model: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 3, nullable: true })
  weight_kg: string | null;

  @Column({ type: 'json', nullable: true })
  dimensions_json: Record<string, any> | null;

  @Column({ type: 'json', nullable: true })
  technical_specs_json: Record<string, any> | null;

  @Column({ type: 'tinyint', width: 1, default: 0 })
  is_hazardous: number;

  @Column({ type: 'json', nullable: true })
  bulk_price_json: Record<string, any> | null;
}

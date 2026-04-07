import { Entity, Column, OneToOne, JoinColumn, PrimaryColumn } from 'typeorm';
import { ProductTemplate } from '../catalog/product-template.entity';

@Entity('contractor_service')
export class ContractorService {
  @PrimaryColumn({ type: 'bigint', unsigned: true })
  product_tmpl_id: string;

  @OneToOne(() => ProductTemplate, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_tmpl_id' })
  product_template: ProductTemplate;

  @Column({ type: 'varchar', length: 80, nullable: true })
  service_type: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true, default: 'on_site' })
  delivery_mode: string | null;

  @Column({ type: 'tinyint', width: 1, default: 1 })
  quote_required: number;

  @Column({ type: 'tinyint', width: 1, default: 0 })
  site_visit_required: number;

  @Column({ type: 'decimal', precision: 8, scale: 2, nullable: true })
  estimated_duration_hours: string | null;

  @Column({ type: 'tinyint', width: 1, default: 0 })
  materials_included: number;

  @Column({ type: 'json', nullable: true })
  service_area_json: Record<string, any> | null;
}

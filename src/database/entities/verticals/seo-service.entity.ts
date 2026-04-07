import { Entity, Column, OneToOne, JoinColumn, PrimaryColumn } from 'typeorm';
import { ProductTemplate } from '../catalog/product-template.entity';

@Entity('seo_service')
export class SeoService {
  @PrimaryColumn({ type: 'bigint', unsigned: true })
  product_tmpl_id: string;

  @OneToOne(() => ProductTemplate, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_tmpl_id' })
  product_template: ProductTemplate;

  @Column({ type: 'varchar', length: 100, nullable: true })
  service_scope: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true, default: 'remote' })
  delivery_mode: string | null;

  @Column({ type: 'tinyint', width: 1, default: 0 })
  gbp_related: number;

  @Column({ type: 'tinyint', width: 1, default: 0 })
  geo_grid_enabled: number;

  @Column({ type: 'varchar', length: 40, nullable: true })
  reporting_frequency: string | null;

  @Column({ type: 'json', nullable: true })
  deliverables_json: Record<string, any> | null;
}

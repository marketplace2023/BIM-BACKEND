import { Entity, Column, OneToOne, JoinColumn, PrimaryColumn } from 'typeorm';
import { ProductTemplate } from '../catalog/product-template.entity';

@Entity('professional_service')
export class ProfessionalService {
  @PrimaryColumn({ type: 'bigint', unsigned: true })
  product_tmpl_id: string;

  @OneToOne(() => ProductTemplate, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_tmpl_id' })
  product_template: ProductTemplate;

  @Column({ type: 'varchar', length: 80, nullable: true })
  service_type: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  service_modality: string | null;

  @Column({ type: 'tinyint', width: 1, default: 0 })
  appointment_required: number;

  @Column({ type: 'varchar', length: 80, nullable: true })
  document_pack_type: string | null;

  @Column({ type: 'json', nullable: true })
  legal_scope_json: Record<string, any> | null;
}

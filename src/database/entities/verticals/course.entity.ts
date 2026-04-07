import { Entity, Column, OneToOne, JoinColumn, PrimaryColumn } from 'typeorm';
import { ProductTemplate } from '../catalog/product-template.entity';

@Entity('course')
export class Course {
  @PrimaryColumn({ type: 'bigint', unsigned: true })
  product_tmpl_id: string;

  @OneToOne(() => ProductTemplate, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_tmpl_id' })
  product_template: ProductTemplate;

  @Column({ type: 'varchar', length: 50, nullable: true })
  level: string | null;

  @Column({ type: 'decimal', precision: 8, scale: 2, nullable: true })
  duration_hours: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  language_code: string | null;

  @Column({ type: 'tinyint', width: 1, default: 0 })
  certificate_available: number;

  @Column({ type: 'varchar', length: 40, nullable: true })
  course_mode: string | null;

  @Column({ type: 'json', nullable: true })
  learning_outcomes_json: Record<string, any> | null;

  @Column({ type: 'json', nullable: true })
  requirements_json: Record<string, any> | null;

  @Column({ type: 'json', nullable: true })
  curriculum_json: Record<string, any> | null;
}

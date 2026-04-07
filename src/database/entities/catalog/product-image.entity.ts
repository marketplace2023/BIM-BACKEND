import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ProductTemplate } from './product-template.entity';

@Entity('product_image')
@Index('idx_product_image_product_sort', ['product_tmpl_id', 'sort_order'])
export class ProductImage {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: string;

  @Column({ type: 'bigint', unsigned: true })
  product_tmpl_id: string;

  @ManyToOne(() => ProductTemplate, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_tmpl_id' })
  product_template: ProductTemplate;

  @Column({ type: 'varchar', length: 500 })
  image_url: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  file_name: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  original_name: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  mime_type: string | null;

  @Column({ type: 'int', nullable: true })
  file_size: number | null;

  @Column({ type: 'int', default: 0 })
  sort_order: number;

  @Column({ type: 'tinyint', width: 1, default: 0 })
  is_cover: number;

  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at: Date;
}

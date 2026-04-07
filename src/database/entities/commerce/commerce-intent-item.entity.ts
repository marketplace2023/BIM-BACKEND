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
import { CommerceIntent } from './commerce-intent.entity';
import { ProductProduct } from '../catalog/product-product.entity';
import { ProductTemplate } from '../catalog/product-template.entity';

@Entity('commerce_intent_item')
@Index('idx_commerce_intent_item_intent', ['intent_id'])
export class CommerceIntentItem {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: string;

  @Column({ type: 'bigint', unsigned: true })
  intent_id: string;

  @ManyToOne(() => CommerceIntent, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'intent_id' })
  intent: CommerceIntent;

  @Column({ type: 'bigint', unsigned: true })
  product_tmpl_id: string;

  @ManyToOne(() => ProductTemplate, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'product_tmpl_id' })
  product_template: ProductTemplate;

  @Column({ type: 'bigint', unsigned: true, nullable: true })
  product_variant_id: string | null;

  @ManyToOne(() => ProductProduct, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'product_variant_id' })
  product_variant: ProductProduct | null;

  @Column({ type: 'varchar', length: 40 })
  item_type: string;

  @Column({ type: 'varchar', length: 255 })
  name_snapshot: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0.0 })
  price_snapshot: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 1.0 })
  qty: string;

  @Column({ type: 'json', nullable: true })
  payload_json: Record<string, any> | null;

  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at: Date;
}

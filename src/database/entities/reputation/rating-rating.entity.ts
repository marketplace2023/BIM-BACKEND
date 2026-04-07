import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Tenant } from '../core/tenant.entity';
import { ResUser } from '../identity/res-user.entity';
import { ResPartner } from '../identity/res-partner.entity';
import { ProductTemplate } from '../catalog/product-template.entity';
import { SaleOrder } from '../commerce/sale-order.entity';

@Entity('rating_rating')
export class RatingRating {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: string;

  @Column({ type: 'bigint', unsigned: true })
  tenant_id: string;

  @ManyToOne(() => Tenant, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ type: 'bigint', unsigned: true })
  reviewer_user_id: string;

  @ManyToOne(() => ResUser, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'reviewer_user_id' })
  reviewer: ResUser;

  @Column({ type: 'bigint', unsigned: true, nullable: true })
  replier_user_id: string | null;

  @ManyToOne(() => ResUser, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'replier_user_id' })
  replier: ResUser | null;

  @Column({ type: 'bigint', unsigned: true, nullable: true })
  partner_id: string | null;

  @ManyToOne(() => ResPartner, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'partner_id' })
  partner: ResPartner | null;

  @Column({ type: 'bigint', unsigned: true, nullable: true })
  product_tmpl_id: string | null;

  @ManyToOne(() => ProductTemplate, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'product_tmpl_id' })
  product_template: ProductTemplate | null;

  @Column({ type: 'bigint', unsigned: true, nullable: true })
  order_id: string | null;

  @ManyToOne(() => SaleOrder, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'order_id' })
  order: SaleOrder | null;

  @Column({ type: 'decimal', precision: 2, scale: 1 })
  rating: string;

  @Column({ type: 'varchar', length: 190, nullable: true })
  title: string | null;

  @Column({ type: 'text', nullable: true })
  comment: string | null;

  @Column({ type: 'varchar', length: 30, default: 'published' })
  status: string;

  @Column({ type: 'text', nullable: true })
  reply_comment: string | null;

  @Column({ type: 'datetime', nullable: true })
  reply_created_at: Date | null;

  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;
}

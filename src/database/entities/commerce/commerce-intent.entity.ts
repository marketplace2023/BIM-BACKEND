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
import { Tenant } from '../core/tenant.entity';
import { ResPartner } from '../identity/res-partner.entity';
import { SaleOrder } from './sale-order.entity';
import { StorePaymentMethod } from '../payments/store-payment-method.entity';

@Entity('commerce_intent')
@Index('idx_commerce_intent_buyer_status', ['buyer_partner_id', 'status'])
@Index('idx_commerce_intent_store_status', ['store_partner_id', 'status'])
export class CommerceIntent {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: string;

  @Column({ type: 'bigint', unsigned: true })
  tenant_id: string;

  @ManyToOne(() => Tenant, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ type: 'bigint', unsigned: true })
  buyer_partner_id: string;

  @ManyToOne(() => ResPartner, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'buyer_partner_id' })
  buyer_partner: ResPartner;

  @Column({ type: 'bigint', unsigned: true })
  store_partner_id: string;

  @ManyToOne(() => ResPartner, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'store_partner_id' })
  store_partner: ResPartner;

  @Column({ type: 'varchar', length: 40 })
  vertical_type: string;

  @Column({ type: 'varchar', length: 40 })
  intent_type: string;

  @Column({ type: 'varchar', length: 40, default: 'draft' })
  status: string;

  @Column({ type: 'char', length: 3, default: 'USD' })
  currency_code: string;

  @Column({ type: 'varchar', length: 40, default: 'unpaid' })
  payment_status: string;

  @Column({ type: 'bigint', unsigned: true, nullable: true })
  payment_method_id: string | null;

  @ManyToOne(() => StorePaymentMethod, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'payment_method_id' })
  payment_method: StorePaymentMethod | null;

  @Column({ type: 'varchar', length: 180, nullable: true })
  payment_reference: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  payment_proof_url: string | null;

  @Column({ type: 'text', nullable: true })
  payment_notes: string | null;

  @Column({ type: 'datetime', nullable: true })
  paid_at: Date | null;

  @Column({ type: 'bigint', unsigned: true, nullable: true })
  validated_by_store_user_id: string | null;

  @Column({ type: 'datetime', nullable: true })
  validated_at: Date | null;

  @Column({ type: 'json', nullable: true })
  summary_json: Record<string, any> | null;

  @Column({ type: 'bigint', unsigned: true, nullable: true })
  converted_order_id: string | null;

  @ManyToOne(() => SaleOrder, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'converted_order_id' })
  converted_order: SaleOrder | null;

  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at: Date;
}

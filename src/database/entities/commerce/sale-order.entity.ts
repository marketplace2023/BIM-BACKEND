import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Tenant } from '../core/tenant.entity';
import { ResPartner } from '../identity/res-partner.entity';
import { StorePaymentMethod } from '../payments/store-payment-method.entity';

@Entity('sale_order')
@Index('idx_order_tenant_status', ['tenant_id', 'status'])
@Index('idx_order_partner', ['partner_id'])
export class SaleOrder {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: string;

  @Column({ type: 'bigint', unsigned: true })
  tenant_id: string;

  @ManyToOne(() => Tenant, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ type: 'varchar', length: 60, unique: true })
  order_number: string;

  @Column({ type: 'bigint', unsigned: true })
  partner_id: string;

  @ManyToOne(() => ResPartner, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'partner_id' })
  partner: ResPartner;

  @Column({ type: 'bigint', unsigned: true, nullable: true })
  x_professional_id: string | null;

  @ManyToOne(() => ResPartner, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'x_professional_id' })
  professional: ResPartner | null;

  @Column({ type: 'varchar', length: 40, default: 'draft' })
  @Index()
  status: string;

  @Column({ type: 'varchar', length: 40, nullable: true })
  x_service_state: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  x_requirement_status: string | null;

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

  @Column({ type: 'datetime', nullable: true })
  x_appointment_datetime: Date | null;

  @Column({ type: 'char', length: 3, default: 'USD' })
  currency_code: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0.0 })
  amount_untaxed: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0.0 })
  amount_tax: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0.0 })
  amount_total: string;

  @Column({ type: 'json', nullable: true })
  meta_json: Record<string, any> | null;

  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at: Date;
}

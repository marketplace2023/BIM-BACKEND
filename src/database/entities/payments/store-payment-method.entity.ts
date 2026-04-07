import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Tenant } from '../core/tenant.entity';
import { ResPartner } from '../identity/res-partner.entity';

@Entity('store_payment_method')
export class StorePaymentMethod {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: string;

  @Column({ type: 'bigint', unsigned: true })
  tenant_id: string;

  @ManyToOne(() => Tenant, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ type: 'bigint', unsigned: true })
  partner_id: string;

  @ManyToOne(() => ResPartner, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'partner_id' })
  partner: ResPartner;

  @Column({ type: 'varchar', length: 60 })
  provider: string;

  @Column({ type: 'varchar', length: 60 })
  method_type: string;

  @Column({ type: 'varchar', length: 160 })
  title: string;

  @Column({ type: 'text', nullable: true })
  instructions: string | null;

  @Column({ type: 'varchar', length: 180, nullable: true })
  account_holder: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  account_number_masked: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: 190, nullable: true })
  email: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  checkout_url: string | null;

  @Column({ type: 'json', nullable: true })
  payload_json: Record<string, any> | null;

  @Column({ type: 'tinyint', width: 1, default: 1 })
  is_enabled: number;

  @Column({ type: 'tinyint', width: 1, default: 0 })
  is_default: number;

  @Column({ type: 'varchar', length: 30, default: 'verified' })
  verification_status: string;

  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at: Date;
}

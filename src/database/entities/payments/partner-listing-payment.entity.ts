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
import { PartnerListingSubscription } from './partner-listing-subscription.entity';
import { ResUser } from '../identity/res-user.entity';

@Entity('partner_listing_payment')
export class PartnerListingPayment {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: string;

  @Column({ type: 'bigint', unsigned: true })
  tenant_id: string;

  @ManyToOne(() => Tenant, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ type: 'bigint', unsigned: true })
  partner_id: string;

  @ManyToOne(() => ResPartner, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'partner_id' })
  partner: ResPartner;

  @Column({ type: 'bigint', unsigned: true })
  subscription_id: string;

  @ManyToOne(() => PartnerListingSubscription, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'subscription_id' })
  subscription: PartnerListingSubscription;

  @Column({ type: 'varchar', length: 60 })
  provider: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  provider_ref: string | null;

  @Column({ type: 'varchar', length: 40, default: 'draft' })
  status: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  amount: string;

  @Column({ type: 'char', length: 3, default: 'USD' })
  currency_code: string;

  @Column({ type: 'varchar', length: 40, default: 'listing_publication' })
  payment_context: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  proof_url: string | null;

  @Column({ type: 'json', nullable: true })
  payload_json: Record<string, any> | null;

  @Column({ type: 'datetime', nullable: true })
  paid_at: Date | null;

  @Column({ type: 'bigint', unsigned: true, nullable: true })
  validated_by_admin_user_id: string | null;

  @ManyToOne(() => ResUser, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'validated_by_admin_user_id' })
  validated_by_admin_user: ResUser | null;

  @Column({ type: 'datetime', nullable: true })
  validated_at: Date | null;

  @Column({ type: 'text', nullable: true })
  validation_notes: string | null;

  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at: Date;
}

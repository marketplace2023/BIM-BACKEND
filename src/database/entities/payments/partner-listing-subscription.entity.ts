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
import { MarketplacePlan } from './marketplace-plan.entity';
import { ResUser } from '../identity/res-user.entity';

@Entity('partner_listing_subscription')
export class PartnerListingSubscription {
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
  plan_id: string;

  @ManyToOne(() => MarketplacePlan, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'plan_id' })
  plan: MarketplacePlan;

  @Column({ type: 'varchar', length: 40, default: 'draft' })
  status: string;

  @Column({ type: 'datetime', nullable: true })
  starts_at: Date | null;

  @Column({ type: 'datetime', nullable: true })
  expires_at: Date | null;

  @Column({ type: 'tinyint', width: 1, default: 0 })
  is_auto_renew: number;

  @Column({ type: 'bigint', unsigned: true, nullable: true })
  activated_by_admin_user_id: string | null;

  @ManyToOne(() => ResUser, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'activated_by_admin_user_id' })
  activated_by_admin_user: ResUser | null;

  @Column({ type: 'datetime', nullable: true })
  activated_at: Date | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at: Date;
}

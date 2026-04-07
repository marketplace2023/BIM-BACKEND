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
import { ResPartner } from './res-partner.entity';

@Entity('res_users')
export class ResUser {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: string;

  @Column({ type: 'bigint', unsigned: true })
  @Index()
  tenant_id: string;

  @ManyToOne(() => Tenant, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ type: 'bigint', unsigned: true })
  @Index()
  partner_id: string;

  @ManyToOne(() => ResPartner, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'partner_id' })
  partner: ResPartner;

  @Column({ type: 'varchar', length: 120, unique: true })
  username: string;

  @Column({ type: 'varchar', length: 190, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 255 })
  password_hash: string;

  @Column({ type: 'tinyint', width: 1, default: 1 })
  is_active: number;

  @Column({ type: 'tinyint', width: 1, default: 0 })
  is_email_verified: number;

  @Column({ type: 'varchar', length: 30, default: 'draft' })
  kyc_status: string;

  @Column({ type: 'json', nullable: true })
  security_json: Record<string, any> | null;

  @Column({ type: 'datetime', nullable: true })
  last_login_at: Date | null;

  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at: Date;
}

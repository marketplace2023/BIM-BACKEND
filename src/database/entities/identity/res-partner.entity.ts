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

@Entity('res_partner')
@Index('idx_partner_tenant_type', ['tenant_id', 'entity_type'])
@Index('idx_partner_geo', ['partner_latitude', 'partner_longitude'])
export class ResPartner {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: string;

  @Column({ type: 'bigint', unsigned: true })
  tenant_id: string;

  @ManyToOne(() => Tenant, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ type: 'varchar', length: 50 })
  @Index()
  entity_type: string;

  @Column({ type: 'varchar', length: 180 })
  @Index()
  name: string;

  @Column({ type: 'varchar', length: 220, nullable: true })
  legal_name: string | null;

  @Column({ type: 'tinyint', width: 1, default: 1 })
  is_company: number;

  @Column({ type: 'varchar', length: 190, nullable: true })
  @Index()
  email: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  website: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  logo_url: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 190, nullable: true })
  street: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  @Index()
  city: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  state: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  country: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  zip: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  partner_latitude: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  partner_longitude: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  x_partner_role: string | null;

  @Column({ type: 'varchar', length: 30, default: 'draft' })
  @Index()
  x_verification_status: string;

  @Column({ type: 'json', nullable: true })
  nap_json: Record<string, any> | null;

  @Column({ type: 'json', nullable: true })
  attributes_json: Record<string, any> | null;

  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at: Date;

  @Column({ type: 'datetime', nullable: true })
  deleted_at: Date | null;
}

import { Entity, Column, OneToOne, JoinColumn, PrimaryColumn } from 'typeorm';
import { ResPartner } from '../identity/res-partner.entity';

@Entity('contractor_profile')
export class ContractorProfile {
  @PrimaryColumn({ type: 'bigint', unsigned: true })
  partner_id: string;

  @OneToOne(() => ResPartner, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'partner_id' })
  partner: ResPartner;

  @Column({ type: 'varchar', length: 50, nullable: true })
  service_area_type: string | null;

  @Column({ type: 'decimal', precision: 8, scale: 2, nullable: true })
  coverage_radius_km: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  license_number: string | null;

  @Column({ type: 'tinyint', width: 1, default: 0 })
  insurance_verified: number;

  @Column({ type: 'tinyint', width: 1, default: 0 })
  emergency_service: number;

  @Column({ type: 'json', nullable: true })
  availability_json: Record<string, any> | null;
}

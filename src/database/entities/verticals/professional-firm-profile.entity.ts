import { Entity, Column, OneToOne, JoinColumn, PrimaryColumn } from 'typeorm';
import { ResPartner } from '../identity/res-partner.entity';

@Entity('professional_firm_profile')
export class ProfessionalFirmProfile {
  @PrimaryColumn({ type: 'bigint', unsigned: true })
  partner_id: string;

  @OneToOne(() => ResPartner, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'partner_id' })
  partner: ResPartner;

  @Column({ type: 'varchar', length: 80, nullable: true })
  firm_type: string | null;

  @Column({ type: 'varchar', length: 180, nullable: true })
  license_registry: string | null;

  @Column({ type: 'json', nullable: true })
  licensed_regions_json: Record<string, any> | null;

  @Column({ type: 'tinyint', width: 1, default: 0 })
  digital_signature_enabled: number;

  @Column({ type: 'varchar', length: 30, default: 'draft' })
  document_validation_status: string;
}

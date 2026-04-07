import { Entity, Column, OneToOne, JoinColumn, PrimaryColumn } from 'typeorm';
import { ResPartner } from '../identity/res-partner.entity';

@Entity('education_provider_profile')
export class EducationProviderProfile {
  @PrimaryColumn({ type: 'bigint', unsigned: true })
  partner_id: string;

  @OneToOne(() => ResPartner, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'partner_id' })
  partner: ResPartner;

  @Column({ type: 'varchar', length: 50, nullable: true })
  accreditation_status: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  institution_type: string | null;

  @Column({ type: 'tinyint', width: 1, default: 0 })
  certification_enabled: number;
}

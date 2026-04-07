import { Entity, Column, OneToOne, JoinColumn, PrimaryColumn } from 'typeorm';
import { ResPartner } from '../identity/res-partner.entity';

@Entity('seo_agency_profile')
export class SeoAgencyProfile {
  @PrimaryColumn({ type: 'bigint', unsigned: true })
  partner_id: string;

  @OneToOne(() => ResPartner, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'partner_id' })
  partner: ResPartner;

  @Column({ type: 'varchar', length: 80, nullable: true })
  google_partner_status: string | null;

  @Column({ type: 'json', nullable: true })
  service_regions_json: Record<string, any> | null;

  @Column({ type: 'json', nullable: true })
  tools_json: Record<string, any> | null;

  @Column({ type: 'decimal', precision: 8, scale: 2, nullable: true })
  avg_response_time_hours: string | null;
}

import { Entity, Column, OneToOne, JoinColumn, PrimaryColumn } from 'typeorm';
import { ResPartner } from '../identity/res-partner.entity';

@Entity('hardware_store_profile')
export class HardwareStoreProfile {
  @PrimaryColumn({ type: 'bigint', unsigned: true })
  partner_id: string;

  @OneToOne(() => ResPartner, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'partner_id' })
  partner: ResPartner;

  @Column({ type: 'tinyint', width: 1, default: 0 })
  pickup_available: number;

  @Column({ type: 'tinyint', width: 1, default: 0 })
  b2b_enabled: number;

  @Column({ type: 'tinyint', width: 1, default: 0 })
  heavy_logistics_enabled: number;

  @Column({ type: 'int', default: 0 })
  warehouse_count: number;
}

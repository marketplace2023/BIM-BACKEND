import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BimObra } from './bim-obra.entity';
import { BimPartida } from './bim-partida.entity';
import { ResUser } from '../identity/res-user.entity';

@Entity('bim_reconsideraciones')
@Index('idx_bim_reconsideraciones_tenant', ['tenant_id'])
@Index('idx_bim_reconsideraciones_obra', ['obra_id'])
@Index('idx_bim_reconsideraciones_partida', ['partida_id'])
export class BimReconsideracion {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: string;

  @Column({ type: 'bigint', unsigned: true })
  tenant_id: string;

  @Column({ type: 'bigint', unsigned: true })
  obra_id: string;

  @ManyToOne(() => BimObra, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'obra_id' })
  obra: BimObra;

  @Column({ type: 'bigint', unsigned: true })
  partida_id: string;

  @ManyToOne(() => BimPartida, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'partida_id' })
  partida: BimPartida;

  @Column({ type: 'varchar', length: 30, default: 'aumento' })
  tipo: string;

  @Column({ type: 'varchar', length: 220 })
  descripcion: string;

  @Column({ type: 'decimal', precision: 14, scale: 4, default: 0 })
  cantidad_original: string;

  @Column({ type: 'decimal', precision: 14, scale: 4, default: 0 })
  cantidad_variacion: string;

  @Column({ type: 'decimal', precision: 14, scale: 4, default: 0 })
  cantidad_nueva: string;

  @Column({ type: 'decimal', precision: 14, scale: 4, default: 0 })
  precio_unitario: string;

  @Column({ type: 'decimal', precision: 16, scale: 2, default: 0 })
  monto_variacion: string;

  @Column({ type: 'text', nullable: true })
  justificacion: string | null;

  @Column({ type: 'varchar', length: 30, default: 'borrador' })
  status: string;

  @Column({ type: 'bigint', unsigned: true })
  created_by: string;

  @ManyToOne(() => ResUser, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'created_by' })
  creador: ResUser;

  @Column({ type: 'bigint', unsigned: true, nullable: true })
  approved_by: string | null;

  @ManyToOne(() => ResUser, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'approved_by' })
  aprobador: ResUser | null;

  @Column({ type: 'datetime', nullable: true })
  approved_at: Date | null;

  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at: Date;
}

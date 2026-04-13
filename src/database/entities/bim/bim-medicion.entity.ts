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

@Entity('bim_mediciones')
@Index('idx_bim_mediciones_tenant', ['tenant_id'])
@Index('idx_bim_mediciones_obra', ['obra_id'])
@Index('idx_bim_mediciones_partida', ['partida_id'])
export class BimMedicion {
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

  @Column({ type: 'date' })
  fecha_medicion: string;

  @Column({ type: 'decimal', precision: 14, scale: 4, default: 0 })
  cantidad_anterior: string;

  @Column({ type: 'decimal', precision: 14, scale: 4, default: 0 })
  cantidad_actual: string;

  @Column({ type: 'decimal', precision: 14, scale: 4, default: 0 })
  cantidad_acumulada: string;

  @Column({ type: 'decimal', precision: 7, scale: 2, default: 0 })
  porcentaje_avance: string;

  @Column({ type: 'text', nullable: true })
  notas: string | null;

  @Column({ type: 'bigint', unsigned: true })
  measured_by: string;

  @ManyToOne(() => ResUser, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'measured_by' })
  medidor: ResUser;

  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at: Date;
}

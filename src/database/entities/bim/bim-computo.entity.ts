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

@Entity('bim_computos')
@Index('idx_bim_computos_tenant', ['tenant_id'])
@Index('idx_bim_computos_obra', ['obra_id'])
@Index('idx_bim_computos_partida', ['partida_id'])
export class BimComputo {
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

  @Column({ type: 'varchar', length: 220 })
  descripcion: string;

  @Column({ type: 'varchar', length: 30, default: 'directo' })
  formula_tipo: string;

  @Column({ type: 'decimal', precision: 14, scale: 4, default: 0 })
  cantidad: string;

  @Column({ type: 'decimal', precision: 14, scale: 4, default: 0 })
  largo: string;

  @Column({ type: 'decimal', precision: 14, scale: 4, default: 0 })
  ancho: string;

  @Column({ type: 'decimal', precision: 14, scale: 4, default: 0 })
  alto: string;

  @Column({ type: 'decimal', precision: 16, scale: 4, default: 0 })
  resultado: string;

  @Column({ type: 'text', nullable: true })
  notas: string | null;

  @Column({ type: 'bigint', unsigned: true })
  created_by: string;

  @ManyToOne(() => ResUser, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'created_by' })
  creador: ResUser;

  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at: Date;
}

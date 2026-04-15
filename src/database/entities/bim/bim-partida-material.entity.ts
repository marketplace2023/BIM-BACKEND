import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { BimPartida } from './bim-partida.entity';
import { BimRecurso } from './bim-recurso.entity';

@Entity('bim_partida_materiales')
@Index('idx_bpm_partida', ['partida_id'])
@Index('idx_bpm_recurso', ['recurso_id'])
@Index('idx_bpm_tipo', ['tipo'])
export class BimPartidaMaterial {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: string;

  @Column({ type: 'bigint', unsigned: true })
  partida_id: string;

  @ManyToOne(() => BimPartida, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'partida_id' })
  partida: BimPartida;

  @Column({ type: 'bigint', unsigned: true, nullable: true })
  recurso_id: string | null;

  @ManyToOne(() => BimRecurso, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'recurso_id' })
  recurso: BimRecurso | null;

  @Column({ type: 'varchar', length: 30, default: 'material' })
  tipo: string;

  @Column({ type: 'varchar', length: 60 })
  codigo: string;

  @Column({ type: 'varchar', length: 300 })
  descripcion: string;

  @Column({ type: 'varchar', length: 20 })
  unidad: string;

  @Column({ type: 'decimal', precision: 14, scale: 4, default: 0 })
  cantidad: string;

  @Column({ type: 'decimal', precision: 14, scale: 4, default: 0 })
  costo: string;

  @Column({ type: 'decimal', precision: 8, scale: 4, default: 0 })
  desperdicio_pct: string;

  @Column({
    type: 'decimal',
    precision: 16,
    scale: 2,
    generatedType: 'STORED',
    asExpression: '(cantidad * costo) * (1 + (desperdicio_pct / 100))',
  })
  total: string;

  @Column({ type: 'smallint', default: 0 })
  orden: number;
}

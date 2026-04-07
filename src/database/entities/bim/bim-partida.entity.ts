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
import { BimCapitulo } from './bim-capitulo.entity';
import { BimPrecioUnitario } from './bim-precio-unitario.entity';

@Entity('bim_partidas')
@Index('idx_partida_capitulo', ['capitulo_id'])
export class BimPartida {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: string;

  @Column({ type: 'bigint', unsigned: true })
  capitulo_id: string;

  @ManyToOne(() => BimCapitulo, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'capitulo_id' })
  capitulo: BimCapitulo;

  @Column({ type: 'bigint', unsigned: true, nullable: true })
  precio_unitario_id: string | null;

  @ManyToOne(() => BimPrecioUnitario, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'precio_unitario_id' })
  precio_unitario_ref: BimPrecioUnitario | null;

  @Column({ type: 'varchar', length: 60 })
  codigo: string;

  @Column({ type: 'text' })
  descripcion: string;

  @Column({ type: 'varchar', length: 20 })
  unidad: string;

  @Column({ type: 'decimal', precision: 14, scale: 4, default: 0 })
  cantidad: string;

  @Column({ type: 'decimal', precision: 14, scale: 4, default: 0 })
  precio_unitario: string;

  // importe_total = cantidad * precio_unitario (columna generada)
  @Column({
    type: 'decimal',
    precision: 16,
    scale: 2,
    generatedType: 'STORED',
    asExpression: 'cantidad * precio_unitario',
  })
  importe_total: string;

  @Column({ type: 'text', nullable: true })
  observaciones: string | null;

  @Column({ type: 'smallint', default: 0 })
  orden: number;

  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at: Date;
}

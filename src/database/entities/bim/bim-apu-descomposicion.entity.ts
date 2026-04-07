import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { BimPrecioUnitario } from './bim-precio-unitario.entity';
import { BimRecurso } from './bim-recurso.entity';

@Entity('bim_apu_descomposicion')
@Index('idx_apu_decom_pu', ['precio_unitario_id'])
export class BimApuDescomposicion {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: string;

  @Column({ type: 'bigint', unsigned: true })
  precio_unitario_id: string;

  @ManyToOne(() => BimPrecioUnitario, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'precio_unitario_id' })
  precio_unitario: BimPrecioUnitario;

  @Column({ type: 'bigint', unsigned: true })
  recurso_id: string;

  @ManyToOne(() => BimRecurso, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'recurso_id' })
  recurso: BimRecurso;

  @Column({ type: 'varchar', length: 30 })
  tipo: string;
  // mano_obra | material | equipo | subcontrato

  @Column({ type: 'decimal', precision: 14, scale: 4, default: 0 })
  cantidad: string;

  @Column({ type: 'decimal', precision: 14, scale: 4, default: 0 })
  precio_recurso: string;

  // importe_total = cantidad * precio_recurso (columna generada)
  @Column({
    type: 'decimal',
    precision: 16,
    scale: 2,
    generatedType: 'STORED',
    asExpression: 'cantidad * precio_recurso',
  })
  importe_total: string;

  @Column({ type: 'smallint', default: 0 })
  orden: number;
}

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { BimCertificacion } from './bim-certificacion.entity';
import { BimPartida } from './bim-partida.entity';

@Entity('bim_lineas_certificacion')
@Index('uq_linea_cert_partida', ['certificacion_id', 'partida_id'], {
  unique: true,
})
export class BimLineaCertificacion {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: string;

  @Column({ type: 'bigint', unsigned: true })
  certificacion_id: string;

  @ManyToOne(() => BimCertificacion, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'certificacion_id' })
  certificacion: BimCertificacion;

  @Column({ type: 'bigint', unsigned: true })
  partida_id: string;

  @ManyToOne(() => BimPartida, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'partida_id' })
  partida: BimPartida;

  @Column({ type: 'decimal', precision: 14, scale: 4, default: 0 })
  cantidad_presupuesto: string;

  @Column({ type: 'decimal', precision: 14, scale: 4, default: 0 })
  cantidad_anterior: string;

  @Column({ type: 'decimal', precision: 14, scale: 4, default: 0 })
  cantidad_actual: string;

  @Column({ type: 'decimal', precision: 14, scale: 4, default: 0 })
  cantidad_acumulada: string;

  @Column({ type: 'decimal', precision: 14, scale: 4, default: 0 })
  precio_unitario: string;

  @Column({ type: 'decimal', precision: 16, scale: 2, default: 0 })
  importe_anterior: string;

  @Column({ type: 'decimal', precision: 16, scale: 2, default: 0 })
  importe_actual: string;

  @Column({ type: 'decimal', precision: 16, scale: 2, default: 0 })
  importe_acumulado: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  porcentaje: string;
}

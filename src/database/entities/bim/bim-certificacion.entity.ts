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
import { BimObra } from './bim-obra.entity';
import { BimMedicionDocumento } from './bim-medicion-documento.entity';
import { BimPresupuesto } from './bim-presupuesto.entity';
import { ResUser } from '../identity/res-user.entity';

@Entity('bim_certificaciones')
@Index('idx_cert_obra_estado', ['obra_id', 'estado'])
export class BimCertificacion {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: string;

  @Column({ type: 'bigint', unsigned: true })
  @Index('idx_cert_tenant')
  tenant_id: string;

  @Column({ type: 'bigint', unsigned: true })
  obra_id: string;

  @ManyToOne(() => BimObra, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'obra_id' })
  obra: BimObra;

  @Column({ type: 'bigint', unsigned: true })
  presupuesto_id: string;

  @ManyToOne(() => BimPresupuesto, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'presupuesto_id' })
  presupuesto: BimPresupuesto;

  @Column({ type: 'bigint', unsigned: true, nullable: true })
  medicion_documento_id: string | null;

  @ManyToOne(() => BimMedicionDocumento, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'medicion_documento_id' })
  medicion_documento: BimMedicionDocumento | null;

  @Column({ type: 'smallint' })
  numero: number;

  @Column({ type: 'date' })
  periodo_desde: Date;

  @Column({ type: 'date' })
  periodo_hasta: Date;

  @Column({ type: 'varchar', length: 30, default: 'borrador' })
  @Index()
  estado: string;
  // borrador | revisada | aprobada | facturada

  @Column({ type: 'decimal', precision: 16, scale: 2, default: 0 })
  total_cert_anterior: string;

  @Column({ type: 'decimal', precision: 16, scale: 2, default: 0 })
  total_cert_actual: string;

  @Column({ type: 'decimal', precision: 16, scale: 2, default: 0 })
  total_cert_acumulado: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  porcentaje_avance: string;

  @Column({ type: 'text', nullable: true })
  observaciones: string | null;

  @Column({ type: 'bigint', unsigned: true, nullable: true })
  aprobado_por: string | null;

  @ManyToOne(() => ResUser, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'aprobado_por' })
  aprobador: ResUser | null;

  @Column({ type: 'datetime', nullable: true })
  fecha_aprobacion: Date | null;

  @Column({ type: 'bigint', unsigned: true })
  created_by: string;

  @ManyToOne(() => ResUser, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'created_by' })
  creator: ResUser;

  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at: Date;
}

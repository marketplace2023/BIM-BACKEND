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
import { ResUser } from '../identity/res-user.entity';

@Entity('bim_presupuestos')
@Index('idx_pres_obra_estado', ['obra_id', 'estado'])
@Index('idx_pres_base', ['presupuesto_base_id'])
@Index('idx_pres_obra_tipo_oficial', ['obra_id', 'tipo', 'es_oficial'])
export class BimPresupuesto {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: string;

  @Column({ type: 'bigint', unsigned: true })
  @Index('idx_pres_tenant')
  tenant_id: string;

  @Column({ type: 'bigint', unsigned: true })
  obra_id: string;

  @ManyToOne(() => BimObra, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'obra_id' })
  obra: BimObra;

  @Column({ type: 'bigint', unsigned: true, nullable: true })
  presupuesto_base_id: string | null;

  @ManyToOne(() => BimPresupuesto, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'presupuesto_base_id' })
  presupuesto_base: BimPresupuesto | null;

  @Column({ type: 'varchar', length: 30, default: 'obra' })
  tipo: string;
  // obra | orientativo | sin_apu | modificado

  @Column({ type: 'smallint', default: 1 })
  version: number;

  @Column({ type: 'tinyint', width: 1, default: 0 })
  es_oficial: boolean;

  @Column({ type: 'varchar', length: 220 })
  nombre: string;

  @Column({ type: 'text', nullable: true })
  descripcion: string | null;

  @Column({ type: 'varchar', length: 30, default: 'borrador' })
  @Index()
  estado: string;
  // borrador | aprobado | revisado | cerrado

  @Column({ type: 'char', length: 3, default: 'USD' })
  moneda: string;

  @Column({ type: 'decimal', precision: 16, scale: 2, default: 0 })
  total_presupuesto: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  gastos_indirectos_pct: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  beneficio_pct: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 21 })
  iva_pct: string;

  @Column({ type: 'bigint', unsigned: true })
  created_by: string;

  @ManyToOne(() => ResUser, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'created_by' })
  creator: ResUser;

  @Column({ type: 'bigint', unsigned: true, nullable: true })
  aprobado_por: string | null;

  @ManyToOne(() => ResUser, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'aprobado_por' })
  aprobador: ResUser | null;

  @Column({ type: 'datetime', nullable: true })
  fecha_aprobacion: Date | null;

  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at: Date;
}

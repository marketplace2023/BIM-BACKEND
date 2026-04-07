import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { ResUser } from '../identity/res-user.entity';

@Entity('bim_obras')
export class BimObra {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: string;

  @Column({ type: 'varchar', length: 60, unique: true })
  codigo: string;

  @Column({ type: 'varchar', length: 220 })
  @Index()
  nombre: string;

  @Column({ type: 'varchar', length: 220 })
  @Index()
  cliente: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  ubicacion: string | null;

  @Column({ type: 'date' })
  fecha_inicio: Date;

  @Column({ type: 'date' })
  fecha_fin_estimada: Date;

  @Column({ type: 'date', nullable: true })
  fecha_fin_real: Date | null;

  @Column({ type: 'varchar', length: 30, default: 'planificacion' })
  @Index()
  estado: string;
  // planificacion | ejecucion | finalizada | suspendida

  @Column({ type: 'char', length: 3, default: 'USD' })
  moneda: string;

  @Column({ type: 'decimal', precision: 16, scale: 2, default: 0 })
  presupuesto_base: string;

  @Column({ type: 'text', nullable: true })
  descripcion: string | null;

  @Column({ type: 'json', nullable: true })
  meta_json: Record<string, any> | null;

  @Column({ type: 'bigint', unsigned: true })
  responsable_id: string;

  @ManyToOne(() => ResUser, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'responsable_id' })
  responsable: ResUser;

  @Column({ type: 'bigint', unsigned: true })
  created_by: string;

  @ManyToOne(() => ResUser, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'created_by' })
  creator: ResUser;

  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at: Date;

  @DeleteDateColumn({ type: 'datetime', nullable: true })
  deleted_at: Date | null;
}

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
import { BimPresupuesto } from './bim-presupuesto.entity';
import { ResUser } from '../identity/res-user.entity';

@Entity('bim_computo_documentos')
@Index('idx_bim_computo_docs_tenant', ['tenant_id'])
@Index('idx_bim_computo_docs_obra', ['obra_id'])
@Index('idx_bim_computo_docs_presupuesto', ['presupuesto_id'])
export class BimComputoDocumento {
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
  presupuesto_id: string;

  @ManyToOne(() => BimPresupuesto, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'presupuesto_id' })
  presupuesto: BimPresupuesto;

  @Column({ type: 'int', unsigned: true })
  numero: number;

  @Column({ type: 'date' })
  fecha: string;

  @Column({ type: 'varchar', length: 220 })
  titulo: string;

  @Column({ type: 'varchar', length: 30, default: 'borrador' })
  status: string;

  @Column({ type: 'text', nullable: true })
  observaciones: string | null;

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

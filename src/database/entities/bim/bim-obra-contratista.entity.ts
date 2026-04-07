import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { BimObra } from './bim-obra.entity';
import { BimContratista } from './bim-contratista.entity';

@Entity('bim_obra_contratistas')
@Index('uq_obra_cont', ['obra_id', 'contratista_id'], { unique: true })
export class BimObraContratista {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: string;

  @Column({ type: 'bigint', unsigned: true })
  obra_id: string;

  @ManyToOne(() => BimObra, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'obra_id' })
  obra: BimObra;

  @Column({ type: 'bigint', unsigned: true })
  contratista_id: string;

  @ManyToOne(() => BimContratista, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'contratista_id' })
  contratista: BimContratista;

  @Column({ type: 'varchar', length: 80, nullable: true })
  rol: string | null;

  @Column({ type: 'decimal', precision: 16, scale: 2, nullable: true })
  monto_contrato: string | null;

  @Column({ type: 'date', nullable: true })
  fecha_inicio: Date | null;

  @Column({ type: 'date', nullable: true })
  fecha_fin: Date | null;

  @Column({ type: 'varchar', length: 30, default: 'vigente' })
  estado: string;
  // vigente | finalizado | rescindido

  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;
}

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
import { BimPresupuesto } from './bim-presupuesto.entity';

@Entity('bim_capitulos')
@Index('idx_cap_presupuesto', ['presupuesto_id'])
@Index('idx_cap_parent', ['parent_id'])
export class BimCapitulo {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: string;

  @Column({ type: 'bigint', unsigned: true })
  presupuesto_id: string;

  @ManyToOne(() => BimPresupuesto, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'presupuesto_id' })
  presupuesto: BimPresupuesto;

  @Column({ type: 'varchar', length: 30 })
  codigo: string;

  @Column({ type: 'varchar', length: 220 })
  nombre: string;

  @Column({ type: 'smallint', default: 0 })
  orden: number;

  @Column({ type: 'bigint', unsigned: true, nullable: true })
  parent_id: string | null;

  @ManyToOne(() => BimCapitulo, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'parent_id' })
  parent: BimCapitulo | null;

  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at: Date;
}

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
import { BimPartida } from './bim-partida.entity';
import { BimPresupuesto } from './bim-presupuesto.entity';
import { ResUser } from '../identity/res-user.entity';

@Entity('bim_memorias_descriptivas')
@Index('idx_bim_memorias_tenant', ['tenant_id'])
@Index('idx_bim_memorias_obra', ['obra_id'])
@Index('idx_bim_memorias_presupuesto', ['presupuesto_id'])
export class BimMemoriaDescriptiva {
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

  @Column({ type: 'bigint', unsigned: true, nullable: true })
  partida_id: string | null;

  @ManyToOne(() => BimPartida, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'partida_id' })
  partida: BimPartida | null;

  @Column({ type: 'varchar', length: 40 })
  tipo: string;

  @Column({ type: 'varchar', length: 220 })
  titulo: string;

  @Column({ type: 'longtext' })
  contenido: string;

  @Column({ type: 'varchar', length: 30, default: 'borrador' })
  status: string;

  @Column({ type: 'bigint', unsigned: true })
  created_by: string;

  @ManyToOne(() => ResUser, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'created_by' })
  creador: ResUser;

  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at: Date;
}

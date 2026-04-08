import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Unique,
} from 'typeorm';

@Entity('bim_recursos')
@Unique('uq_brec_tenant_codigo', ['tenant_id', 'codigo'])
export class BimRecurso {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: string;

  @Column({ type: 'bigint', unsigned: true })
  @Index('idx_brec_tenant')
  tenant_id: string;

  @Column({ type: 'varchar', length: 60 })
  codigo: string;

  @Column({ type: 'varchar', length: 300 })
  descripcion: string;

  @Column({ type: 'varchar', length: 20 })
  unidad: string;

  @Column({ type: 'varchar', length: 30 })
  @Index()
  tipo: string;
  // mano_obra | material | equipo | subcontrato

  @Column({ type: 'decimal', precision: 14, scale: 4, default: 0 })
  precio: string;

  @Column({ type: 'date' })
  vigencia: Date;

  @Column({ type: 'tinyint', width: 1, default: 1 })
  @Index()
  activo: number;

  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at: Date;
}

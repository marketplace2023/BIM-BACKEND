import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Unique,
} from 'typeorm';

@Entity('bim_precios_unitarios')
@Unique('uq_bpu_tenant_codigo', ['tenant_id', 'codigo'])
export class BimPrecioUnitario {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: string;

  @Column({ type: 'bigint', unsigned: true })
  @Index('idx_bpu_tenant')
  tenant_id: string;

  @Column({ type: 'varchar', length: 60 })
  codigo: string;

  @Column({ type: 'text' })
  descripcion: string;

  @Column({ type: 'varchar', length: 20 })
  unidad: string;

  @Column({ type: 'varchar', length: 60, nullable: true })
  @Index()
  categoria: string | null;

  @Column({ type: 'decimal', precision: 14, scale: 4, default: 0 })
  precio_base: string;

  @Column({ type: 'decimal', precision: 8, scale: 4, default: 1 })
  rendimiento: string;

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

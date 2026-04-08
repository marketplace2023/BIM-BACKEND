import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
  Unique,
} from 'typeorm';

@Entity('bim_contratistas')
@Unique('uq_bim_cont_tenant_rut', ['tenant_id', 'rut_nif'])
export class BimContratista {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: string;

  @Column({ type: 'bigint', unsigned: true })
  @Index('idx_bim_cont_tenant')
  tenant_id: string;

  @Column({ type: 'varchar', length: 220 })
  @Index()
  nombre: string;

  @Column({ type: 'varchar', length: 220, nullable: true })
  nombre_legal: string | null;

  @Column({ type: 'varchar', length: 60, nullable: true })
  rut_nif: string | null;

  @Column({ type: 'varchar', length: 30, default: 'empresa' })
  tipo: string;
  // empresa | persona_natural | subcontratista

  @Column({ type: 'varchar', length: 200, nullable: true })
  contacto_nombre: string | null;

  @Column({ type: 'varchar', length: 190, nullable: true })
  contacto_email: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  contacto_tel: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  direccion: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  ciudad: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true, default: 'España' })
  pais: string | null;

  @Column({ type: 'varchar', length: 30, default: 'activo' })
  @Index()
  estado: string;
  // activo | inactivo | suspendido

  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at: Date;

  @DeleteDateColumn({ type: 'datetime', nullable: true })
  deleted_at: Date | null;
}

import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { BimPresupuesto } from './bim-presupuesto.entity';
import { BimReconsideracionDocumento } from './bim-reconsideracion-documento.entity';

@Entity('bim_presupuesto_modificado_fuentes')
@Index('idx_bpmf_presupuesto', ['presupuesto_id'])
@Index('idx_bpmf_documento', ['documento_id'])
@Index('idx_bpmf_unique', ['presupuesto_id', 'documento_id'], { unique: true })
export class BimPresupuestoModificadoFuente {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: string;

  @Column({ type: 'bigint', unsigned: true })
  tenant_id: string;

  @Column({ type: 'bigint', unsigned: true })
  presupuesto_id: string;

  @ManyToOne(() => BimPresupuesto, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'presupuesto_id' })
  presupuesto: BimPresupuesto;

  @Column({ type: 'bigint', unsigned: true })
  documento_id: string;

  @ManyToOne(() => BimReconsideracionDocumento, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'documento_id' })
  documento: BimReconsideracionDocumento;

  @Column({ type: 'varchar', length: 30 })
  tipo_documento: string;

  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;
}

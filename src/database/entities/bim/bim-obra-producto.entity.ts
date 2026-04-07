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
import { BimPartida } from './bim-partida.entity';
import { ProductTemplate } from '../catalog/product-template.entity';

@Entity('bim_obra_productos')
@Index('idx_bop_obra', ['obra_id'])
export class BimObraProducto {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: string;

  @Column({ type: 'bigint', unsigned: true })
  obra_id: string;

  @ManyToOne(() => BimObra, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'obra_id' })
  obra: BimObra;

  @Column({ type: 'bigint', unsigned: true })
  product_tmpl_id: string;

  @ManyToOne(() => ProductTemplate, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'product_tmpl_id' })
  producto: ProductTemplate;

  @Column({ type: 'bigint', unsigned: true, nullable: true })
  partida_id: string | null;

  @ManyToOne(() => BimPartida, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'partida_id' })
  partida: BimPartida | null;

  @Column({ type: 'varchar', length: 300, nullable: true })
  descripcion_uso: string | null;

  @Column({ type: 'decimal', precision: 14, scale: 4, default: 1 })
  cantidad: string;

  @Column({ type: 'decimal', precision: 14, scale: 4, nullable: true })
  precio_referencia: string | null;

  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;
}

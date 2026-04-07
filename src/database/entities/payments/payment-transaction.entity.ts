import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Tenant } from '../core/tenant.entity';
import { SaleOrder } from '../commerce/sale-order.entity';

@Entity('payment_transaction')
export class PaymentTransaction {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: string;

  @Column({ type: 'bigint', unsigned: true })
  tenant_id: string;

  @ManyToOne(() => Tenant, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ type: 'bigint', unsigned: true })
  order_id: string;

  @ManyToOne(() => SaleOrder, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'order_id' })
  order: SaleOrder;

  @Column({ type: 'varchar', length: 60 })
  provider: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  provider_ref: string | null;

  @Column({ type: 'varchar', length: 40 })
  status: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: string;

  @Column({ type: 'char', length: 3, default: 'USD' })
  currency_code: string;

  @Column({ type: 'json', nullable: true })
  payload_json: Record<string, any> | null;

  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;
}

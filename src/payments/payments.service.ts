import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentTransaction } from '../database/entities/payments/payment-transaction.entity';
import { SaleOrder } from '../database/entities/commerce/sale-order.entity';
import { CreatePaymentDto } from './dto/create-payment.dto';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(PaymentTransaction)
    private txRepo: Repository<PaymentTransaction>,
    @InjectRepository(SaleOrder) private ordersRepo: Repository<SaleOrder>,
  ) {}

  async create(tenantId: string, partnerId: string, dto: CreatePaymentDto) {
    const order = await this.ordersRepo.findOne({
      where: { id: dto.order_id },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.partner_id !== partnerId)
      throw new ForbiddenException('Not your order');

    const tx = await this.txRepo.save(
      this.txRepo.create({
        tenant_id: tenantId,
        order_id: dto.order_id,
        provider: dto.provider,
        provider_ref: null,
        status: 'pending',
        amount: String(dto.amount),
        currency_code: dto.currency_code ?? order.currency_code,
        payload_json: null,
      }),
    );
    return tx;
  }

  async findOne(id: string, partnerId: string) {
    const tx = await this.txRepo.findOne({
      where: { id },
      relations: ['order'],
    });
    if (!tx) throw new NotFoundException('Payment not found');
    if (tx.order.partner_id !== partnerId)
      throw new ForbiddenException('Access denied');
    return tx;
  }

  async handleWebhook(provider: string, payload: Record<string, any>) {
    // Extract provider reference and status from payload
    const providerRef: string | null = payload?.id ?? payload?.data?.id ?? null;
    const rawStatus: string =
      payload?.status ?? payload?.data?.attributes?.status ?? 'unknown';

    const statusMap: Record<string, string> = {
      approved: 'paid',
      succeeded: 'paid',
      paid: 'paid',
      pending: 'pending',
      in_process: 'pending',
      rejected: 'failed',
      failed: 'failed',
      cancelled: 'cancelled',
    };
    const status = statusMap[rawStatus] ?? rawStatus;

    if (providerRef) {
      await this.txRepo.update(
        { provider, provider_ref: providerRef },
        { status, payload_json: payload },
      );
    }
    return { received: true };
  }
}

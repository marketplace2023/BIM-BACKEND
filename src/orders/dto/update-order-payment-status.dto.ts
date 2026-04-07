import { IsIn } from 'class-validator';

export class UpdateOrderPaymentStatusDto {
  @IsIn(['pending_validation', 'paid', 'failed', 'cancelled'])
  payment_status: string;
}

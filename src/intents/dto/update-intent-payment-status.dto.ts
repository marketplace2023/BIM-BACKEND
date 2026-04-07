import { IsIn } from 'class-validator';

export class UpdateIntentPaymentStatusDto {
  @IsIn(['pending_validation', 'paid', 'failed', 'cancelled'])
  payment_status: string;
}

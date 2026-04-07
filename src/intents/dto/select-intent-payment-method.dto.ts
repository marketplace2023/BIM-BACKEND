import { IsString } from 'class-validator';

export class SelectIntentPaymentMethodDto {
  @IsString()
  payment_method_id: string;
}

import { IsString } from 'class-validator';

export class SelectOrderPaymentMethodDto {
  @IsString()
  payment_method_id: string;
}

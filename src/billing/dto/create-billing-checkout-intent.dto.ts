import { IsString } from 'class-validator';

export class CreateBillingCheckoutIntentDto {
  @IsString()
  plan_code: string;
}

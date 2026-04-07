import { IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreatePaymentDto {
  @IsString()
  order_id: string;

  @IsIn(['stripe', 'mercadopago', 'manual'])
  provider: string;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsString()
  @IsOptional()
  currency_code?: string;
}

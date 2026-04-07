import { IsBoolean, IsOptional, IsString, IsUrl } from 'class-validator';

export class UpsertStorePaymentMethodDto {
  @IsString()
  provider: string;

  @IsString()
  method_type: string;

  @IsString()
  title: string;

  @IsString()
  @IsOptional()
  instructions?: string;

  @IsString()
  @IsOptional()
  account_holder?: string;

  @IsString()
  @IsOptional()
  account_number_masked?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  email?: string;

  @IsUrl()
  @IsOptional()
  checkout_url?: string;

  @IsBoolean()
  @IsOptional()
  is_enabled?: boolean;

  @IsBoolean()
  @IsOptional()
  is_default?: boolean;
}

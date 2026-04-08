import {
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreatePublicProductIntentDto {
  @IsString()
  product_tmpl_id: string;

  @IsString()
  @MaxLength(180)
  buyer_name: string;

  @IsEmail()
  buyer_email: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  buyer_phone?: string;

  @IsString()
  @IsOptional()
  @MaxLength(220)
  company?: string;

  @IsString()
  @IsOptional()
  @MaxLength(120)
  city?: string;

  @IsString()
  @IsOptional()
  @MaxLength(120)
  country?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  qty?: number;

  @IsString()
  @IsOptional()
  message?: string;
}

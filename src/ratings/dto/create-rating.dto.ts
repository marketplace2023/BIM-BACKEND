import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateRatingDto {
  @IsString()
  @IsOptional()
  partner_id?: string;

  @IsString()
  @IsOptional()
  product_tmpl_id?: string;

  @IsString()
  @IsOptional()
  order_id?: string;

  @IsNumber()
  @Min(1)
  @Max(5)
  rating: number;

  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  comment?: string;
}

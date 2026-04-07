import { Type } from 'class-transformer';
import {
  IsArray,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateOrderLineDto {
  @IsString()
  product_tmpl_id: string;

  @IsString()
  @IsOptional()
  product_variant_id?: string;

  @IsString()
  name: string;

  @IsNumber()
  @Min(0.01)
  qty: number;

  @IsNumber()
  @Min(0)
  price_unit: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  discount?: number;

  @IsObject()
  @IsOptional()
  line_meta_json?: Record<string, any>;
}

export class CreateOrderDto {
  @IsString()
  @IsOptional()
  professional_id?: string;

  @IsString()
  @IsOptional()
  currency_code?: string;

  @IsObject()
  @IsOptional()
  meta_json?: Record<string, any>;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderLineDto)
  lines: CreateOrderLineDto[];
}

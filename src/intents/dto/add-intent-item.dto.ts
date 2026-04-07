import {
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class AddIntentItemDto {
  @IsString()
  product_tmpl_id: string;

  @IsString()
  @IsOptional()
  product_variant_id?: string;

  @IsNumber()
  @Min(1)
  @IsOptional()
  qty?: number;

  @IsString()
  @IsOptional()
  @IsIn(['catalog_purchase', 'course_enrollment', 'service_request', 'quote_request'])
  intent_type?: string;

  @IsObject()
  @IsOptional()
  payload_json?: Record<string, any>;
}

import { IsNumber, IsObject, IsOptional, Min } from 'class-validator';

export class UpdateIntentItemDto {
  @IsNumber()
  @Min(1)
  @IsOptional()
  qty?: number;

  @IsObject()
  @IsOptional()
  payload_json?: Record<string, any>;
}

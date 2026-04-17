import { IsDateString, IsOptional, IsString } from 'class-validator';

export class UpdateCertificacionDto {
  @IsOptional()
  @IsString()
  medicion_documento_id?: string | null;

  @IsOptional()
  @IsDateString()
  periodo_desde?: string;

  @IsOptional()
  @IsDateString()
  periodo_hasta?: string;

  @IsOptional()
  @IsString()
  observaciones?: string;
}

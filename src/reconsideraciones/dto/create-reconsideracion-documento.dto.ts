import { IsDateString, IsIn, IsOptional, IsString } from 'class-validator';

export class CreateReconsideracionDocumentoDto {
  @IsString()
  obra_id: string;

  @IsString()
  presupuesto_id: string;

  @IsOptional()
  @IsIn(['aumento', 'disminucion', 'precio', 'extra'])
  tipo?: string;

  @IsOptional()
  @IsString()
  certificacion_id?: string;

  @IsOptional()
  @IsDateString()
  fecha?: string;

  @IsOptional()
  @IsString()
  titulo?: string;

  @IsOptional()
  @IsString()
  observaciones?: string;
}

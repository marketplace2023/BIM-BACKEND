import { IsDateString, IsIn, IsOptional, IsString } from 'class-validator';

export class CreateReconsideracionDocumentoDto {
  @IsString()
  obra_id: string;

  @IsString()
  presupuesto_id: string;

  @IsOptional()
  @IsIn(['aumento', 'disminucion'])
  tipo?: string;

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

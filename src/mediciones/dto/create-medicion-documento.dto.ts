import { IsDateString, IsOptional, IsString } from 'class-validator';

export class CreateMedicionDocumentoDto {
  @IsString()
  obra_id: string;

  @IsString()
  presupuesto_id: string;

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

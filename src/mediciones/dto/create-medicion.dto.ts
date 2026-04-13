import { IsDateString, IsOptional, IsString } from 'class-validator';

export class CreateMedicionDto {
  @IsString()
  obra_id: string;

  @IsString()
  partida_id: string;

  @IsDateString()
  fecha_medicion: string;

  @IsString()
  cantidad_actual: string;

  @IsString()
  @IsOptional()
  notas?: string;
}

import { IsOptional, IsString } from 'class-validator';

export class CreateReconsideracionDto {
  @IsString()
  obra_id: string;

  @IsString()
  partida_id: string;

  @IsString()
  tipo: string;

  @IsString()
  descripcion: string;

  @IsString()
  cantidad_variacion: string;

  @IsString()
  @IsOptional()
  justificacion?: string;
}

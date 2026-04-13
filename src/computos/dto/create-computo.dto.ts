import { IsOptional, IsString } from 'class-validator';

export class CreateComputoDto {
  @IsString()
  obra_id: string;

  @IsString()
  partida_id: string;

  @IsString()
  descripcion: string;

  @IsString()
  formula_tipo: string;

  @IsString()
  @IsOptional()
  cantidad?: string;

  @IsString()
  @IsOptional()
  largo?: string;

  @IsString()
  @IsOptional()
  ancho?: string;

  @IsString()
  @IsOptional()
  alto?: string;

  @IsString()
  @IsOptional()
  notas?: string;
}

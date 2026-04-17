import { IsIn, IsOptional, IsString } from 'class-validator';

export class CreateMemoriaDto {
  @IsString()
  obra_id: string;

  @IsString()
  presupuesto_id: string;

  @IsOptional()
  @IsString()
  partida_id?: string;

  @IsIn(['proyecto', 'partida', 'aumento', 'disminucion', 'extra'])
  tipo: string;

  @IsString()
  titulo: string;

  @IsString()
  contenido: string;
}

import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsIn,
  IsDateString,
  IsNumberString,
} from 'class-validator';

export class CreateRecursoDto {
  @IsString()
  @IsNotEmpty()
  codigo: string;

  @IsString()
  @IsNotEmpty()
  descripcion: string;

  @IsString()
  @IsNotEmpty()
  unidad: string;

  @IsIn(['mano_obra', 'material', 'equipo', 'subcontrato'])
  tipo: string;

  @IsNumberString()
  precio: string;

  @IsDateString()
  vigencia: string;
}

export class CreatePrecioUnitarioDto {
  @IsString()
  @IsNotEmpty()
  codigo: string;

  @IsString()
  @IsNotEmpty()
  descripcion: string;

  @IsString()
  @IsNotEmpty()
  unidad: string;

  @IsOptional()
  @IsString()
  categoria?: string;

  @IsOptional()
  @IsNumberString()
  rendimiento?: string;

  @IsDateString()
  vigencia: string;
}

export class CreateDescomposicionDto {
  @IsString()
  recurso_id: string;

  @IsIn(['mano_obra', 'material', 'equipo', 'subcontrato'])
  tipo: string;

  @IsNumberString()
  cantidad: string;

  @IsNumberString()
  precio_recurso: string;

  @IsOptional()
  orden?: number;
}

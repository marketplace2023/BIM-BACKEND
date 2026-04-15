import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsIn,
  IsNumberString,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePartidaDto {
  @IsOptional()
  @IsString()
  precio_unitario_id?: string;

  @IsString()
  @IsNotEmpty()
  codigo: string;

  @IsString()
  @IsNotEmpty()
  descripcion: string;

  @IsString()
  @IsNotEmpty()
  unidad: string;

  @IsNumberString()
  cantidad: string;

  @IsNumberString()
  precio_unitario: string;

  @IsOptional()
  @IsString()
  observaciones?: string;

  @IsOptional()
  orden?: number;
}

export class CreatePartidaMaterialDto {
  @IsOptional()
  @IsIn(['material', 'equipo', 'mano_obra'])
  tipo?: string;

  @IsOptional()
  @IsString()
  recurso_id?: string;

  @IsString()
  @IsNotEmpty()
  codigo: string;

  @IsString()
  @IsNotEmpty()
  descripcion: string;

  @IsString()
  @IsNotEmpty()
  unidad: string;

  @IsNumberString()
  cantidad: string;

  @IsNumberString()
  costo: string;

  @IsOptional()
  @IsNumberString()
  desperdicio_pct?: string;

  @IsOptional()
  orden?: number;
}

export class CreateCapituloDto {
  @IsString()
  @IsNotEmpty()
  codigo: string;

  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsOptional()
  orden?: number;

  @IsOptional()
  @IsString()
  parent_id?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePartidaDto)
  partidas?: CreatePartidaDto[];
}

export class CreatePresupuestoDto {
  @IsString()
  @IsNotEmpty()
  obra_id: string;

  @IsOptional()
  @IsIn(['obra', 'orientativo'])
  tipo?: string;

  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @IsString()
  moneda?: string;

  @IsOptional()
  @IsNumberString()
  gastos_indirectos_pct?: string;

  @IsOptional()
  @IsNumberString()
  beneficio_pct?: string;

  @IsOptional()
  @IsNumberString()
  iva_pct?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateCapituloDto)
  capitulos?: CreateCapituloDto[];
}

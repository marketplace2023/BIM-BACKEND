import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsIn,
  IsDateString,
  IsArray,
  ValidateNested,
  IsNumberString,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateLineaCertificacionDto {
  @IsString()
  partida_id: string;

  @IsNumberString()
  cantidad_presupuesto: string;

  @IsNumberString()
  cantidad_anterior: string;

  @IsNumberString()
  cantidad_actual: string;

  @IsNumberString()
  precio_unitario: string;
}

export class CreateCertificacionDto {
  @IsString()
  @IsNotEmpty()
  obra_id: string;

  @IsString()
  @IsNotEmpty()
  presupuesto_id: string;

  @IsString()
  @IsNotEmpty()
  medicion_documento_id: string;

  @IsDateString()
  periodo_desde: string;

  @IsDateString()
  periodo_hasta: string;

  @IsOptional()
  @IsString()
  observaciones?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateLineaCertificacionDto)
  lineas?: CreateLineaCertificacionDto[];
}

export class AprobarCertificacionDto {
  @IsIn(['revisada', 'aprobada', 'facturada'])
  estado: string;

  @IsOptional()
  @IsString()
  observaciones?: string;
}

import {
  IsArray,
  IsNumberString,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SaveReconsideracionDetalleItemDto {
  @IsOptional()
  @IsString()
  partida_id?: string;

  @IsOptional()
  @IsString()
  capitulo_id?: string;

  @IsOptional()
  @IsString()
  codigo?: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @IsString()
  unidad?: string;

  @IsOptional()
  @IsNumberString()
  cantidad_variacion?: string;

  @IsOptional()
  @IsNumberString()
  precio_unitario?: string;

  @IsOptional()
  @IsNumberString()
  precio_unitario_reconsiderado?: string;

  @IsOptional()
  @IsString()
  justificacion?: string;
}

export class SaveReconsideracionDetallesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaveReconsideracionDetalleItemDto)
  detalles: SaveReconsideracionDetalleItemDto[];
}

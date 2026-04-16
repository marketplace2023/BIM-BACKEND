import {
  IsArray,
  IsNumberString,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SaveReconsideracionDetalleItemDto {
  @IsString()
  partida_id: string;

  @IsNumberString()
  cantidad_variacion: string;

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

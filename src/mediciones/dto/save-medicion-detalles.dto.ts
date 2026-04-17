import {
  IsArray,
  IsNumberString,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SaveMedicionDetalleItemDto {
  @IsString()
  partida_id: string;

  @IsNumberString()
  cantidad_actual: string;

  @IsOptional()
  @IsString()
  notas?: string;
}

export class SaveMedicionDetallesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaveMedicionDetalleItemDto)
  detalles: SaveMedicionDetalleItemDto[];
}

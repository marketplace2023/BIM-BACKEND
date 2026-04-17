import {
  IsArray,
  IsNumberString,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SaveCertificacionDetalleDto {
  @IsString()
  partida_id: string;

  @IsNumberString()
  cantidad_actual: string;
}

export class SaveCertificacionDetallesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaveCertificacionDetalleDto)
  detalles: SaveCertificacionDetalleDto[];
}

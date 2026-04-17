import {
  IsArray,
  IsIn,
  IsNumberString,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SaveComputoDetalleItemDto {
  @IsString()
  partida_id: string;

  @IsString()
  descripcion: string;

  @IsIn(['directo', 'largo', 'largo_x_ancho', 'largo_x_ancho_x_alto'])
  formula_tipo: string;

  @IsOptional()
  @IsNumberString()
  cantidad?: string;

  @IsOptional()
  @IsNumberString()
  largo?: string;

  @IsOptional()
  @IsNumberString()
  ancho?: string;

  @IsOptional()
  @IsNumberString()
  alto?: string;

  @IsOptional()
  @IsString()
  notas?: string;
}

export class SaveComputoDetallesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaveComputoDetalleItemDto)
  detalles: SaveComputoDetalleItemDto[];
}

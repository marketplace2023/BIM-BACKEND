import {
  IsString,
  IsOptional,
  IsNumberString,
  IsDateString,
  IsIn,
} from 'class-validator';

export class AsignarContratistaDto {
  @IsString()
  contratista_id: string;

  @IsOptional()
  @IsString()
  rol?: string;

  @IsOptional()
  @IsNumberString()
  monto_contrato?: string;

  @IsOptional()
  @IsDateString()
  fecha_inicio?: string;

  @IsOptional()
  @IsDateString()
  fecha_fin?: string;

  @IsOptional()
  @IsIn(['vigente', 'finalizado', 'rescindido'])
  estado?: string;
}

import {
  IsString,
  IsNotEmpty,
  IsDateString,
  IsOptional,
  IsNumberString,
  IsIn,
} from 'class-validator';

export class CreateObraDto {
  @IsString()
  @IsNotEmpty()
  codigo: string;

  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsString()
  @IsNotEmpty()
  cliente: string;

  @IsOptional()
  @IsString()
  ubicacion?: string;

  @IsDateString()
  fecha_inicio: string;

  @IsDateString()
  fecha_fin_estimada: string;

  @IsOptional()
  @IsDateString()
  fecha_fin_real?: string;

  @IsOptional()
  @IsIn(['planificacion', 'ejecucion', 'finalizada', 'suspendida'])
  estado?: string;

  @IsOptional()
  @IsString()
  moneda?: string;

  @IsOptional()
  @IsNumberString()
  presupuesto_base?: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  meta_json?: Record<string, any>;

  @IsString()
  @IsNotEmpty()
  responsable_id: string;
}

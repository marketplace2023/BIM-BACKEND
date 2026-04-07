import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEmail,
  IsIn,
} from 'class-validator';

export class CreateContratistaDto {
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsOptional()
  @IsString()
  nombre_legal?: string;

  @IsOptional()
  @IsString()
  rut_nif?: string;

  @IsOptional()
  @IsIn(['empresa', 'persona_natural', 'subcontratista'])
  tipo?: string;

  @IsOptional()
  @IsString()
  contacto_nombre?: string;

  @IsOptional()
  @IsEmail()
  contacto_email?: string;

  @IsOptional()
  @IsString()
  contacto_tel?: string;

  @IsOptional()
  @IsString()
  direccion?: string;

  @IsOptional()
  @IsString()
  ciudad?: string;

  @IsOptional()
  @IsString()
  pais?: string;
}

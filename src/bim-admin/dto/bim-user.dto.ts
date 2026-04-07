import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsIn,
  IsEmail,
  MinLength,
} from 'class-validator';

export class CreateBimUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  username: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  @IsNotEmpty()
  full_name: string;

  @IsOptional()
  @IsIn([
    'admin',
    'director_obra',
    'jefe_produccion',
    'administrativo',
    'supervisor',
    'consulta',
  ])
  role?: string;
}

export class UpdateBimUserDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  full_name?: string;

  @IsOptional()
  @IsIn([
    'admin',
    'director_obra',
    'jefe_produccion',
    'administrativo',
    'supervisor',
    'consulta',
  ])
  role?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @IsOptional()
  is_active?: number;
}

export class BimLoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}

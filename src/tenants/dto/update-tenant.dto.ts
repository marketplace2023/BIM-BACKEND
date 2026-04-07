import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateTenantDto {
  @IsString()
  @MaxLength(150)
  @IsOptional()
  name?: string;

  @IsString()
  @MaxLength(120)
  @IsOptional()
  slug?: string;

  @IsString()
  @IsOptional()
  @MaxLength(190)
  domain?: string;

  @IsIn(['active', 'inactive'])
  @IsOptional()
  status?: string;

  @IsOptional()
  settings_json?: Record<string, any>;
}

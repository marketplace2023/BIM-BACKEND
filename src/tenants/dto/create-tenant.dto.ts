import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateTenantDto {
  @IsString()
  @MaxLength(150)
  name: string;

  @IsString()
  @MaxLength(120)
  slug: string;

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

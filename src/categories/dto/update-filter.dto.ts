import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateFilterDto {
  @IsString() @MaxLength(120) @IsOptional() name?: string;
  @IsIn(['range', 'select', 'multiselect', 'boolean'])
  @IsOptional()
  filter_type?: string;
  @IsOptional() config_json?: Record<string, any>;
  @IsOptional() sequence?: number;
  @IsOptional() is_active?: number;
}

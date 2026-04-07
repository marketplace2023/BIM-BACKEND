import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateFilterDto {
  @IsString()
  @MaxLength(120)
  name: string;

  @IsIn(['range', 'select', 'multiselect', 'boolean'])
  filter_type: string;

  @IsOptional()
  config_json?: Record<string, any>;

  @IsOptional()
  sequence?: number;
}

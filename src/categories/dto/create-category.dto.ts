import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateCategoryDto {
  @IsIn([
    'contractor',
    'education_provider',
    'hardware_store',
    'professional_firm',
    'seo_agency',
  ])
  vertical_type: string;

  @IsString()
  @IsOptional()
  parent_id?: string;

  @IsString()
  @MaxLength(150)
  name: string;

  @IsString()
  @MaxLength(180)
  @IsOptional()
  slug?: string;

  @IsOptional()
  sequence?: number;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  image_url?: string;

  @IsString()
  @IsOptional()
  meta_title?: string;

  @IsString()
  @IsOptional()
  meta_description?: string;

  @IsString()
  @IsOptional()
  meta_keywords?: string;
}

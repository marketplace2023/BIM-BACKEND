import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateCategoryDto {
  @IsString() @MaxLength(150) @IsOptional() name?: string;
  @IsString() @MaxLength(180) @IsOptional() slug?: string;
  @IsString() @IsOptional() parent_id?: string;
  @IsOptional() sequence?: number;
  @IsString() @IsOptional() description?: string;
  @IsString() @IsOptional() image_url?: string;
  @IsString() @IsOptional() meta_title?: string;
  @IsString() @IsOptional() meta_description?: string;
  @IsString() @IsOptional() meta_keywords?: string;
  @IsOptional() active?: number;
  @IsOptional() show_on_website?: number;
}

import {
  IsArray,
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

export class UpsertStoreGbpDto {
  @IsString()
  @IsOptional()
  account_name?: string;

  @IsString()
  @IsOptional()
  location_name?: string;

  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  website_uri?: string;

  @IsString()
  @IsOptional()
  primary_phone?: string;

  @IsString()
  @IsOptional()
  maps_uri?: string;

  @IsString()
  @IsOptional()
  place_id?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsBoolean()
  @IsOptional()
  linked?: boolean;

  @IsArray()
  @IsOptional()
  categories?: string[];

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}

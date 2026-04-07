import {
  IsBoolean,
  IsEmail,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdateStoreDto {
  @IsString() @MaxLength(180) @IsOptional() name?: string;
  @IsString() @MaxLength(220) @IsOptional() legal_name?: string;
  @IsEmail() @IsOptional() email?: string;
  @IsString() @IsOptional() phone?: string;
  @IsString() @IsOptional() website?: string;
  @IsString() @IsOptional() logo_url?: string;
  @IsString() @IsOptional() description?: string;
  @IsString() @IsOptional() street?: string;
  @IsString() @IsOptional() city?: string;
  @IsString() @IsOptional() state?: string;
  @IsString() @IsOptional() country?: string;
  @IsString() @IsOptional() zip?: string;
  @IsNumber() @IsOptional() partner_latitude?: number;
  @IsNumber() @IsOptional() partner_longitude?: number;
  @IsObject() @IsOptional() nap_json?: Record<string, any>;
  @IsObject() @IsOptional() attributes_json?: Record<string, any>;

  // contractor
  @IsString() @IsOptional() service_area_type?: string;
  @IsNumber() @IsOptional() coverage_radius_km?: number;
  @IsString() @IsOptional() license_number?: string;
  @IsBoolean() @IsOptional() insurance_verified?: boolean;
  @IsBoolean() @IsOptional() emergency_service?: boolean;
  @IsObject() @IsOptional() availability_json?: Record<string, any>;

  // education
  @IsString() @IsOptional() accreditation_status?: string;
  @IsString() @IsOptional() institution_type?: string;
  @IsBoolean() @IsOptional() certification_enabled?: boolean;

  // hardware
  @IsBoolean() @IsOptional() pickup_available?: boolean;
  @IsBoolean() @IsOptional() b2b_enabled?: boolean;
  @IsBoolean() @IsOptional() heavy_logistics_enabled?: boolean;
  @IsNumber() @IsOptional() warehouse_count?: number;

  // professional firm
  @IsString() @IsOptional() firm_type?: string;
  @IsString() @IsOptional() license_registry?: string;
  @IsObject() @IsOptional() licensed_regions_json?: Record<string, any>;
  @IsBoolean() @IsOptional() digital_signature_enabled?: boolean;

  // seo agency
  @IsString() @IsOptional() google_partner_status?: string;
  @IsObject() @IsOptional() service_regions_json?: Record<string, any>;
  @IsObject() @IsOptional() tools_json?: Record<string, any>;
  @IsNumber() @IsOptional() avg_response_time_hours?: number;
}

import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateProductDto {
  // ── Shared template fields ───────────────────────────────────────────
  @IsString() @IsOptional() categ_id?: string;

  @IsIn(['service', 'course', 'product', 'package'])
  listing_type: string;

  @IsIn([
    'contractor',
    'education_provider',
    'hardware_store',
    'professional_firm',
    'seo_agency',
  ])
  vertical_type: string;

  @IsString() @MaxLength(190) name: string;

  @IsString() @IsOptional() description_sale?: string;

  @IsNumber() @Min(0) list_price: number;

  @IsNumber() @IsOptional() compare_price?: number;

  @IsString() @IsOptional() currency_code?: string;

  @IsIn(['service', 'product']) @IsOptional() type?: string;

  @IsObject() @IsOptional() x_attributes_json?: Record<string, any>;
  @IsObject() @IsOptional() seo_json?: Record<string, any>;
  @IsObject() @IsOptional() cta_json?: Record<string, any>;

  @IsString() @IsOptional() cover_image_url?: string;

  // ── contractor_service ───────────────────────────────────────────────
  @IsString() @IsOptional() service_type?: string;
  @IsString() @IsOptional() delivery_mode?: string;
  @IsBoolean() @IsOptional() quote_required?: boolean;
  @IsBoolean() @IsOptional() site_visit_required?: boolean;
  @IsNumber() @IsOptional() estimated_duration_hours?: number;
  @IsBoolean() @IsOptional() materials_included?: boolean;
  @IsObject() @IsOptional() service_area_json?: Record<string, any>;

  // ── course ───────────────────────────────────────────────────────────
  @IsString() @IsOptional() level?: string;
  @IsNumber() @IsOptional() duration_hours?: number;
  @IsString() @IsOptional() language_code?: string;
  @IsBoolean() @IsOptional() certificate_available?: boolean;
  @IsString() @IsOptional() course_mode?: string;
  @IsObject() @IsOptional() learning_outcomes_json?: Record<string, any>;
  @IsObject() @IsOptional() requirements_json?: Record<string, any>;
  @IsObject() @IsOptional() curriculum_json?: Record<string, any>;

  // ── hardware_product ─────────────────────────────────────────────────
  @IsString() @IsOptional() brand?: string;
  @IsString() @IsOptional() model?: string;
  @IsNumber() @IsOptional() weight_kg?: number;
  @IsObject() @IsOptional() dimensions_json?: Record<string, any>;
  @IsObject() @IsOptional() technical_specs_json?: Record<string, any>;
  @IsBoolean() @IsOptional() is_hazardous?: boolean;
  @IsObject() @IsOptional() bulk_price_json?: Record<string, any>;

  // ── professional_service ─────────────────────────────────────────────
  @IsString() @IsOptional() service_modality?: string;
  @IsBoolean() @IsOptional() appointment_required?: boolean;
  @IsString() @IsOptional() document_pack_type?: string;
  @IsObject() @IsOptional() legal_scope_json?: Record<string, any>;

  // ── seo_service ──────────────────────────────────────────────────────
  @IsString() @IsOptional() service_scope?: string;
  @IsBoolean() @IsOptional() gbp_related?: boolean;
  @IsBoolean() @IsOptional() geo_grid_enabled?: boolean;
  @IsString() @IsOptional() reporting_frequency?: string;
  @IsObject() @IsOptional() deliverables_json?: Record<string, any>;
}

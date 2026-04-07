import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import {
  MARKETPLACE_ROLES,
  SELLER_ENTITY_TYPES,
} from '../../common/constants/marketplace.constants';

export class RegisterDto {
  @IsString()
  @IsOptional()
  tenant_id?: string;

  @IsString()
  username: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  name: string;

  @IsIn(MARKETPLACE_ROLES)
  role: string;

  @IsIn(SELLER_ENTITY_TYPES)
  @IsOptional()
  entity_type?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  country?: string;
}

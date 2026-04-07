import { PartialType } from '@nestjs/mapped-types';
import {
  CreateRecursoDto,
  CreatePrecioUnitarioDto,
  CreateDescomposicionDto,
} from './create-precio-unitario.dto';

export class UpdateRecursoDto extends PartialType(CreateRecursoDto) {}
export class UpdatePrecioUnitarioDto extends PartialType(
  CreatePrecioUnitarioDto,
) {}
export class UpdateDescomposicionDto extends PartialType(
  CreateDescomposicionDto,
) {}

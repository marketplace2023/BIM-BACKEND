import { PartialType, OmitType } from '@nestjs/mapped-types';
import {
  CreatePresupuestoDto,
  CreateCapituloDto,
  CreatePartidaDto,
  CreatePartidaMaterialDto,
} from './create-presupuesto.dto';

export class UpdatePresupuestoDto extends PartialType(
  OmitType(CreatePresupuestoDto, ['capitulos', 'obra_id'] as const),
) {}

export class UpdateCapituloDto extends PartialType(
  OmitType(CreateCapituloDto, ['partidas'] as const),
) {}

export class UpdatePartidaDto extends PartialType(CreatePartidaDto) {}

export class UpdatePartidaMaterialDto extends PartialType(CreatePartidaMaterialDto) {}

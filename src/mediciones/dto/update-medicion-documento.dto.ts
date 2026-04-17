import { PartialType } from '@nestjs/mapped-types';
import { CreateMedicionDocumentoDto } from './create-medicion-documento.dto';

export class UpdateMedicionDocumentoDto extends PartialType(
  CreateMedicionDocumentoDto,
) {}

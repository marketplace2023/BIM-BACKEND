import { PartialType } from '@nestjs/mapped-types';
import { CreateComputoDocumentoDto } from './create-computo-documento.dto';

export class UpdateComputoDocumentoDto extends PartialType(
  CreateComputoDocumentoDto,
) {}

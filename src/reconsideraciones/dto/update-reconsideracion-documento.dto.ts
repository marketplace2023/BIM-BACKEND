import { PartialType } from '@nestjs/mapped-types';
import { CreateReconsideracionDocumentoDto } from './create-reconsideracion-documento.dto';

export class UpdateReconsideracionDocumentoDto extends PartialType(
  CreateReconsideracionDocumentoDto,
) {}

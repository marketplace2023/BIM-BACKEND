import { PartialType } from '@nestjs/mapped-types';
import { CreateMedicionDto } from './create-medicion.dto';

export class UpdateMedicionDto extends PartialType(CreateMedicionDto) {}

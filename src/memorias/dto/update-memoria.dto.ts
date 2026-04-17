import { PartialType } from '@nestjs/mapped-types';
import { CreateMemoriaDto } from './create-memoria.dto';

export class UpdateMemoriaDto extends PartialType(CreateMemoriaDto) {}

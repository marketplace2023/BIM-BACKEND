import { PartialType } from '@nestjs/mapped-types';
import { CreateContratistaDto } from './create-contratista.dto';

export class UpdateContratistaDto extends PartialType(CreateContratistaDto) {}

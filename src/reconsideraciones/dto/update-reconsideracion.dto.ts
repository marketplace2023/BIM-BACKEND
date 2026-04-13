import { PartialType } from '@nestjs/mapped-types';
import { CreateReconsideracionDto } from './create-reconsideracion.dto';

export class UpdateReconsideracionDto extends PartialType(CreateReconsideracionDto) {}

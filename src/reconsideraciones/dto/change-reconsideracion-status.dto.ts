import { IsString } from 'class-validator';

export class ChangeReconsideracionStatusDto {
  @IsString()
  status: 'borrador' | 'aprobada' | 'rechazada';
}

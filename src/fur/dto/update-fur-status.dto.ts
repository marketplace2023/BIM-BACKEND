import { IsIn } from 'class-validator';
import { FUR_STATUSES } from '../../common/constants/marketplace.constants';

export class UpdateFurStatusDto {
  @IsIn(FUR_STATUSES)
  status: string;
}

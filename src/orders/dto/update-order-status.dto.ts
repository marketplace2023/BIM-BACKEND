import { IsIn } from 'class-validator';

export class UpdateOrderStatusDto {
  @IsIn(['confirmed', 'in_progress', 'done', 'cancelled'])
  status: string;
}

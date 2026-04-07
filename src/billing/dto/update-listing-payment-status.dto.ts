import { IsIn, IsOptional, IsString } from 'class-validator';

export class UpdateListingPaymentStatusDto {
  @IsIn(['validated', 'rejected'])
  status: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

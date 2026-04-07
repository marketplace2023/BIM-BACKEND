import { IsOptional, IsString } from 'class-validator';

export class SubmitOrderPaymentProofDto {
  @IsString()
  @IsOptional()
  payment_reference?: string;

  @IsString()
  @IsOptional()
  payment_proof_url?: string;

  @IsString()
  @IsOptional()
  payment_notes?: string;
}

import { IsOptional, IsString } from 'class-validator';

export class SubmitIntentPaymentProofDto {
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

import { IsIn, IsOptional, IsString } from 'class-validator';

export class ChangeDocumentStatusDto {
  @IsIn(['borrador', 'revisado', 'aprobado'])
  status: string;

  @IsOptional()
  @IsString()
  observaciones?: string;
}

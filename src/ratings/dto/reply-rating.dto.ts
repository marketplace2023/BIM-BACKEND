import { IsString, MinLength } from 'class-validator';

export class ReplyRatingDto {
  @IsString()
  @MinLength(2)
  comment: string;
}

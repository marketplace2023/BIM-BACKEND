import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { CreatePublicProductIntentDto } from './dto/create-public-product-intent.dto';
import { IntentsService } from './intents.service';

@Controller('public/intents')
export class PublicIntentsController {
  constructor(private readonly intentsService: IntentsService) {}

  @Post('product-lead')
  @HttpCode(HttpStatus.CREATED)
  createProductLead(@Body() dto: CreatePublicProductIntentDto) {
    return this.intentsService.createPublicProductLead(dto);
  }
}

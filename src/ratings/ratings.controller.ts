import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RatingsService } from './ratings.service';
import { CreateRatingDto } from './dto/create-rating.dto';
import { ReplyRatingDto } from './dto/reply-rating.dto';

@Controller('ratings')
export class RatingsController {
  constructor(private svc: RatingsService) {}

  /** POST /api/ratings */
  @UseGuards(JwtAuthGuard)
  @Post()
  create(
    @CurrentUser() user: { id: string; tenant_id: string },
    @Body() dto: CreateRatingDto,
  ) {
    return this.svc.create(user.tenant_id, user.id, dto);
  }

  /** GET /api/ratings?partner_id=&product_tmpl_id=&page=1&limit=10 */
  @Get()
  findAll(
    @Query('partner_id') partner_id?: string,
    @Query('product_tmpl_id') product_tmpl_id?: string,
    @Query('reviewer_user_id') reviewer_user_id?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.svc.findAll({
      partner_id,
      product_tmpl_id,
      reviewer_user_id,
      page,
      limit,
    });
  }

  /** GET /api/ratings/mine?page=1&limit=20 */
  @UseGuards(JwtAuthGuard)
  @Get('mine')
  findMine(
    @CurrentUser() user: { id: string },
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.svc.findAll({ reviewer_user_id: user.id, page, limit });
  }

  /** PATCH /api/ratings/:id/reply */
  @UseGuards(JwtAuthGuard)
  @Patch(':id/reply')
  reply(
    @Param('id') id: string,
    @CurrentUser()
    user: { id: string; tenant_id: string; partner_id: string; email?: string },
    @Headers('x-store-context') storeContextId: string | undefined,
    @Body() dto: ReplyRatingDto,
  ) {
    return this.svc.reply(id, user, dto, storeContextId);
  }

  /** DELETE /api/ratings/:id */
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.svc.remove(id, user.id);
  }
}

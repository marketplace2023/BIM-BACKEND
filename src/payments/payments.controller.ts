import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';

@Controller('payments')
export class PaymentsController {
  constructor(private svc: PaymentsService) {}

  /** POST /api/payments */
  @UseGuards(JwtAuthGuard)
  @Post()
  create(
    @CurrentUser() user: { tenant_id: string; partner_id: string },
    @Body() dto: CreatePaymentDto,
  ) {
    return this.svc.create(user.tenant_id, user.partner_id, dto);
  }

  /** GET /api/payments/:id */
  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: { partner_id: string },
  ) {
    return this.svc.findOne(id, user.partner_id);
  }

  /** POST /api/payments/webhook/:provider  (public - no JWT) */
  @Post('webhook/:provider')
  webhook(
    @Param('provider') provider: string,
    @Body() payload: Record<string, any>,
  ) {
    return this.svc.handleWebhook(provider, payload);
  }
}

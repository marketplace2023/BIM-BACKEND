import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { BillingService } from './billing.service';
import { CreateBillingCheckoutIntentDto } from './dto/create-billing-checkout-intent.dto';

@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @UseGuards(JwtAuthGuard)
  @Get('plans')
  getPlans(@CurrentUser() user: { tenant_id: string }) {
    return this.billingService.getPlans(user.tenant_id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('my-subscription')
  getMySubscription(
    @CurrentUser()
    user: { tenant_id: string; partner_id: string; email?: string },
    @Headers('x-store-context') storeContextId?: string,
  ) {
    return this.billingService.getMySubscription(user, storeContextId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('create-checkout-intent')
  createCheckoutIntent(
    @CurrentUser()
    user: { tenant_id: string; partner_id: string; email?: string },
    @Headers('x-store-context') storeContextId: string | undefined,
    @Body() dto: CreateBillingCheckoutIntentDto,
  ) {
    return this.billingService.createCheckoutIntent(user, storeContextId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('payments/:id/sync')
  syncPayment(
    @CurrentUser()
    user: { tenant_id: string; partner_id: string; email?: string },
    @Headers('x-store-context') storeContextId: string | undefined,
    @Param('id') paymentId: string,
  ) {
    return this.billingService.syncPayment(user, storeContextId, paymentId);
  }

  @Post('webhook/stripe')
  handleStripeWebhook(
    @Req() req: Request & { rawBody?: Buffer },
    @Headers('stripe-signature') signature?: string,
    @Body() payload?: any,
  ) {
    return this.billingService.handleStripeWebhook(
      req.rawBody,
      signature,
      payload,
    );
  }
}

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
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { BimJwtGuard } from '../common/guards/bim-jwt.guard';
import { AddIntentItemDto } from './dto/add-intent-item.dto';
import { SelectIntentPaymentMethodDto } from './dto/select-intent-payment-method.dto';
import { SubmitIntentPaymentProofDto } from './dto/submit-intent-payment-proof.dto';
import { UpdateIntentItemDto } from './dto/update-intent-item.dto';
import { UpdateIntentPaymentStatusDto } from './dto/update-intent-payment-status.dto';
import { IntentsService } from './intents.service';

@UseGuards(BimJwtGuard)
@Controller('intents')
export class IntentsController {
  constructor(private readonly intentsService: IntentsService) {}

  @Get('mine')
  findMine(
    @CurrentUser() user: { tenant_id: string; partner_id: string },
    @Query('vertical_type') verticalType?: string,
    @Query('intent_type') intentType?: string,
    @Query('status') status?: string,
  ) {
    return this.intentsService.findMine(user, { verticalType, intentType, status });
  }

  @Get('store')
  findStoreIntents(
    @CurrentUser() user: { tenant_id: string; partner_id: string; email?: string },
    @Headers('x-store-context') storeContextId?: string,
    @Query('vertical_type') verticalType?: string,
    @Query('intent_type') intentType?: string,
    @Query('status') status?: string,
  ) {
    return this.intentsService.findStore(user, storeContextId, {
      verticalType,
      intentType,
      status,
    });
  }

  @Post('items')
  addItem(
    @CurrentUser() user: { id: string; tenant_id: string; partner_id: string },
    @Body() dto: AddIntentItemDto,
  ) {
    return this.intentsService.addItem(user, dto);
  }

  @Patch('items/:id')
  updateItem(
    @Param('id') id: string,
    @CurrentUser() user: { tenant_id: string; partner_id: string },
    @Body() dto: UpdateIntentItemDto,
  ) {
    return this.intentsService.updateItem(id, user, dto);
  }

  @Delete('items/:id')
  removeItem(
    @Param('id') id: string,
    @CurrentUser() user: { tenant_id: string; partner_id: string },
  ) {
    return this.intentsService.removeItem(id, user);
  }

  @Post(':id/submit')
  submit(
    @Param('id') id: string,
    @CurrentUser() user: { tenant_id: string; partner_id: string },
  ) {
    return this.intentsService.submit(id, user);
  }

  @Patch(':id/payment-method')
  selectPaymentMethod(
    @Param('id') id: string,
    @CurrentUser() user: { tenant_id: string; partner_id: string },
    @Body() dto: SelectIntentPaymentMethodDto,
  ) {
    return this.intentsService.selectPaymentMethod(id, user, dto);
  }

  @Patch(':id/payment-proof')
  submitPaymentProof(
    @Param('id') id: string,
    @CurrentUser() user: { tenant_id: string; partner_id: string },
    @Body() dto: SubmitIntentPaymentProofDto,
  ) {
    return this.intentsService.submitPaymentProof(id, user, dto);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @CurrentUser() user: { tenant_id: string; partner_id: string; email?: string },
    @Headers('x-store-context') storeContextId: string | undefined,
    @Body() body: { status: string },
  ) {
    return this.intentsService.updateStatus(id, user, storeContextId, body.status);
  }

  @Patch(':id/payment-status')
  updatePaymentStatus(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; tenant_id: string; partner_id: string; email?: string },
    @Headers('x-store-context') storeContextId: string | undefined,
    @Body() dto: UpdateIntentPaymentStatusDto,
  ) {
    return this.intentsService.updatePaymentStatus(id, user, storeContextId, dto);
  }
}

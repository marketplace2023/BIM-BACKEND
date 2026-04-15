import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { UpsertStorePaymentMethodDto } from './dto/upsert-store-payment-method.dto';
import { StorePaymentMethodsService } from './store-payment-methods.service';

@Controller('store-payment-methods')
export class StorePaymentMethodsController {
  constructor(private readonly service: StorePaymentMethodsService) {}

  @UseGuards(JwtAuthGuard)
  @Get('mine')
  findMine(
    @CurrentUser()
    user: { tenant_id: string; partner_id: string; email?: string },
    @Headers('x-store-context') storeContextId?: string,
  ) {
    return this.service.findMine(user, storeContextId);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  create(
    @CurrentUser()
    user: { tenant_id: string; partner_id: string; email?: string },
    @Headers('x-store-context') storeContextId: string | undefined,
    @Body() dto: UpsertStorePaymentMethodDto,
  ) {
    return this.service.create(user, storeContextId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @CurrentUser()
    user: { tenant_id: string; partner_id: string; email?: string },
    @Headers('x-store-context') storeContextId: string | undefined,
    @Body() dto: UpsertStorePaymentMethodDto,
  ) {
    return this.service.update(id, user, storeContextId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(
    @Param('id') id: string,
    @CurrentUser()
    user: { tenant_id: string; partner_id: string; email?: string },
    @Headers('x-store-context') storeContextId: string | undefined,
  ) {
    return this.service.remove(id, user, storeContextId);
  }
}

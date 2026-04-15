import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AdminRoleGuard } from '../common/guards/admin-role.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { UpdateFurStatusDto } from './dto/update-fur-status.dto';
import { UpsertStoreGbpDto } from './dto/upsert-store-gbp.dto';
import { FurService } from './fur.service';

@UseGuards(JwtAuthGuard)
@Controller('fur')
export class FurController {
  constructor(private readonly furService: FurService) {}

  @Get('workspace')
  getWorkspace(
    @CurrentUser()
    user: {
      id: string;
      partner_id: string;
      role?: string;
      roles?: string[];
    },
  ) {
    return this.furService.getWorkspace(user);
  }

  @Get('store/:id')
  getStore(@Param('id') id: string) {
    return this.furService.getStoreFur(id);
  }

  @Get('product/:id')
  getProduct(@Param('id') id: string) {
    return this.furService.getProductFur(id);
  }

  @Patch('store/:id/status')
  updateStoreStatus(
    @Param('id') id: string,
    @Body() dto: UpdateFurStatusDto,
    @CurrentUser()
    user: { partner_id: string; role?: string; roles?: string[] },
  ) {
    return this.furService.updateStoreStatus(id, dto.status as any, user);
  }

  @UseGuards(AdminRoleGuard)
  @Patch('user/:id/status')
  updateUserStatus(
    @Param('id') id: string,
    @Body() dto: UpdateFurStatusDto,
    @CurrentUser()
    user: { role?: string; roles?: string[] },
  ) {
    return this.furService.updateUserStatus(id, dto.status as any, user);
  }

  @Patch('product/:id/status')
  updateProductStatus(
    @Param('id') id: string,
    @Body() dto: UpdateFurStatusDto,
    @CurrentUser()
    user: { partner_id: string; role?: string; roles?: string[] },
  ) {
    return this.furService.updateProductStatus(id, dto.status as any, user);
  }

  @Patch('store/:id/gbp')
  updateStoreGbp(
    @Param('id') id: string,
    @Body() dto: UpsertStoreGbpDto,
    @CurrentUser()
    user: { partner_id: string; role?: string; roles?: string[] },
  ) {
    return this.furService.saveStoreGbpProfile(id, dto, user);
  }
}

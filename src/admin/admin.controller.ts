import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AdminRoleGuard } from '../common/guards/admin-role.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { BillingService } from '../billing/billing.service';
import { UpdateListingPaymentStatusDto } from '../billing/dto/update-listing-payment-status.dto';

@UseGuards(JwtAuthGuard, AdminRoleGuard)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly billingService: BillingService,
  ) {}

  @Get('dashboard')
  getDashboard(@CurrentUser() user: { tenant_id: string }) {
    return this.adminService.getDashboard(user.tenant_id);
  }

  @Get('users')
  getUsers(@CurrentUser() user: { tenant_id: string }) {
    return this.adminService.getUsers(user.tenant_id);
  }

  @Get('ratings')
  getRatings(
    @CurrentUser() user: { tenant_id: string },
    @Query('status') status?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.adminService.getRatings(user.tenant_id, { status, page, limit });
  }

  @Patch('ratings/:id/status')
  updateRatingStatus(
    @CurrentUser() user: { tenant_id: string },
    @Param('id') id: string,
    @Body() body: { status: string },
  ) {
    return this.adminService.updateRatingStatus(user.tenant_id, id, body.status);
  }

  @Get('billing/payments')
  getBillingPayments(
    @CurrentUser() user: { tenant_id: string },
    @Query('status') status?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.billingService.getAdminPayments(user.tenant_id, { status, page, limit });
  }

  @Patch('billing/payments/:id/status')
  updateBillingPaymentStatus(
    @CurrentUser() user: { tenant_id: string; id: string },
    @Param('id') id: string,
    @Body() body: UpdateListingPaymentStatusDto,
  ) {
    return this.billingService.updateAdminPaymentStatus(
      user.tenant_id,
      user.id,
      id,
      body.status as 'validated' | 'rejected',
      body.notes,
    );
  }

  @Get('payments')
  getCommercialPayments(
    @CurrentUser() user: { tenant_id: string },
    @Query('payment_status') payment_status?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.adminService.getCommercialPayments(user.tenant_id, {
      payment_status,
      page,
      limit,
    });
  }
}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { ResPartner } from '../database/entities/identity/res-partner.entity';
import { ResUser } from '../database/entities/identity/res-user.entity';
import { ProductTemplate } from '../database/entities/catalog/product-template.entity';
import { CommerceIntent } from '../database/entities/commerce/commerce-intent.entity';
import { Course } from '../database/entities/verticals/course.entity';
import { SaleOrder } from '../database/entities/commerce/sale-order.entity';
import { RatingRating } from '../database/entities/reputation/rating-rating.entity';
import { AdminRoleGuard } from '../common/guards/admin-role.guard';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [
    BillingModule,
    TypeOrmModule.forFeature([
      ResPartner,
      ResUser,
      ProductTemplate,
      CommerceIntent,
      Course,
      SaleOrder,
      RatingRating,
    ]),
  ],
  controllers: [AdminController],
  providers: [AdminService, AdminRoleGuard],
})
export class AdminModule {}

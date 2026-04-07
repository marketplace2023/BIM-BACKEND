import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ResPartner } from '../database/entities/identity/res-partner.entity';
import { ResUser } from '../database/entities/identity/res-user.entity';
import { MarketplacePlan } from '../database/entities/payments/marketplace-plan.entity';
import { PartnerListingPayment } from '../database/entities/payments/partner-listing-payment.entity';
import { PartnerListingSubscription } from '../database/entities/payments/partner-listing-subscription.entity';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([
      MarketplacePlan,
      PartnerListingSubscription,
      PartnerListingPayment,
      ResPartner,
      ResUser,
    ]),
  ],
  controllers: [BillingController],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}

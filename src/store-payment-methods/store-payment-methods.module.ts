import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ResPartner } from '../database/entities/identity/res-partner.entity';
import { StorePaymentMethod } from '../database/entities/payments/store-payment-method.entity';
import { StorePaymentMethodsController } from './store-payment-methods.controller';
import { StorePaymentMethodsService } from './store-payment-methods.service';

@Module({
  imports: [TypeOrmModule.forFeature([StorePaymentMethod, ResPartner])],
  controllers: [StorePaymentMethodsController],
  providers: [StorePaymentMethodsService],
  exports: [StorePaymentMethodsService],
})
export class StorePaymentMethodsModule {}

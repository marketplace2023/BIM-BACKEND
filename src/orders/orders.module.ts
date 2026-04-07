import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SaleOrder } from '../database/entities/commerce/sale-order.entity';
import { SaleOrderLine } from '../database/entities/commerce/sale-order-line.entity';
import { ProductProduct } from '../database/entities/catalog/product-product.entity';
import { ProductTemplate } from '../database/entities/catalog/product-template.entity';
import { ResPartner } from '../database/entities/identity/res-partner.entity';
import { StorePaymentMethod } from '../database/entities/payments/store-payment-method.entity';
import { Course } from '../database/entities/verticals/course.entity';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SaleOrder,
      SaleOrderLine,
      ProductProduct,
      ProductTemplate,
      ResPartner,
      StorePaymentMethod,
      Course,
    ]),
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}

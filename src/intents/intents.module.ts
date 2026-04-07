import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductTemplate } from '../database/entities/catalog/product-template.entity';
import { ProductProduct } from '../database/entities/catalog/product-product.entity';
import { CommerceIntent } from '../database/entities/commerce/commerce-intent.entity';
import { CommerceIntentItem } from '../database/entities/commerce/commerce-intent-item.entity';
import { SaleOrder } from '../database/entities/commerce/sale-order.entity';
import { SaleOrderLine } from '../database/entities/commerce/sale-order-line.entity';
import { ResPartner } from '../database/entities/identity/res-partner.entity';
import { StockQuant } from '../database/entities/inventory/stock-quant.entity';
import { StorePaymentMethod } from '../database/entities/payments/store-payment-method.entity';
import { IntentsController } from './intents.controller';
import { IntentsService } from './intents.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CommerceIntent,
      CommerceIntentItem,
      ProductTemplate,
      ProductProduct,
      SaleOrder,
      SaleOrderLine,
      ResPartner,
      StockQuant,
      StorePaymentMethod,
    ]),
  ],
  controllers: [IntentsController],
  providers: [IntentsService],
  exports: [IntentsService],
})
export class IntentsModule {}

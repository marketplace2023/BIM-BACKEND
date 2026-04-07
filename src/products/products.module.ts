import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductTemplate } from '../database/entities/catalog/product-template.entity';
import { ProductProduct } from '../database/entities/catalog/product-product.entity';
import { ProductImage } from '../database/entities/catalog/product-image.entity';
import { StockQuant } from '../database/entities/inventory/stock-quant.entity';
import { ResPartner } from '../database/entities/identity/res-partner.entity';
import { ContractorService } from '../database/entities/verticals/contractor-service.entity';
import { Course } from '../database/entities/verticals/course.entity';
import { HardwareProduct } from '../database/entities/verticals/hardware-product.entity';
import { ProfessionalService } from '../database/entities/verticals/professional-service.entity';
import { SeoService } from '../database/entities/verticals/seo-service.entity';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProductTemplate,
      ProductProduct,
      ProductImage,
      StockQuant,
      ResPartner,
      ContractorService,
      Course,
      HardwareProduct,
      ProfessionalService,
      SeoService,
    ]),
  ],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
